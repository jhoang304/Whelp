import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import restaurantsReducer from "../../../store/restaurants";
import { UPDATE_REVIEW_PATH } from "../paths";
import UpdateReview from "./index";
import { axe } from "../../../testUtils/axe";
import type { Mock } from "vitest";

/**
 * The edit form, where a review's photos can go as well as come.
 *
 * Removing one it already has is its own request and takes effect at once,
 * once it has been asked and answered (#131).
 * Adding follows the create form -- upload, save, attach -- and when some
 * attach and some do not, only the failures stay staged, so trying again
 * cannot put the others on the review twice.
 *
 * The page loads the review it is about, and offers the form only to its
 * author, at the restaurant it belongs to (#112).
 */

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useHistory: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockUploadImage = vi.fn();
vi.mock("../../../utils/uploads", async () => ({
  ...(await vi.importActual<typeof import("../../../utils/uploads")>("../../../utils/uploads")),
  uploadImage: (file: File) => mockUploadImage(file),
}));

const RESTAURANT = 3;
const REVIEW = 42;
const EXISTING = 5;
const AUTHOR = { id: 2, username: "author", first_name: "Au", last_name: "Thor" };

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (errors: string[], status = 400) => ({ ok: false, status, json: () => Promise.resolve({ errors }) });

const review = {
  id: REVIEW, user_id: AUTHOR.id, restaurant_id: RESTAURANT, review: "Solid.", rating: 4,
  createdAt: "", updatedAt: "",
  reviewImages: [{ id: EXISTING, review_id: REVIEW, url: "https://bucket/old.png", createdAt: "", updatedAt: "" }],
  restaurant: { id: RESTAURANT, user_id: 1, name: "Uchi" },
  user: { id: AUTHOR.id, username: AUTHOR.username },
  response: null,
};

/**
 * Answer GET /api/reviews/42 with `found`, and anything else with `others`.
 * The review is what the page asks for first, and again after a partial save.
 */
function serve(others: (url: string, options: any) => any = () => okJson({}), found: any = okJson(review)) {
  (global as any).fetch = vi.fn((url: string, options: any = {}) => {
    if ((options.method ?? "GET") === "GET" && url === `/api/reviews/${REVIEW}`) return Promise.resolve(found);
    return Promise.resolve(others(url, options));
  });
}

let where: any;

function renderForm({ state, user = AUTHOR, stored = {}, path = `/${RESTAURANT}/reviews/${REVIEW}/update` }:
  { state?: any; user?: any; stored?: any; path?: string } = {}) {
  const store = createStore(
    combineReducers({
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
      session: (sessionState = { user }) => sessionState,
    }),
    { reviews: stored } as any,
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Route path={UPDATE_REVIEW_PATH}>
          <UpdateReview />
        </Route>
        <Route path="*" render={({ location }) => { where = location; return null; }} />
      </MemoryRouter>
    </Provider>
  );
}

const attachCalls = () =>
  ((global as any).fetch as Mock).mock.calls
    .filter(([url, options]) => options?.method === "POST" && url === `/api/reviews/${REVIEW}/images`)
    .map(([, options]) => JSON.parse(options.body).url);

const reviewBox = () => screen.findByRole("textbox") as Promise<HTMLInputElement>;
/** The stars chosen, as the checked radio's value. */
const chosenRating = () => (screen.getByRole("radio", { checked: true }) as HTMLInputElement).value;

beforeEach(() => {
  let n = 0;
  (global.URL as any).createObjectURL = vi.fn(() => `blob:${n++}`);
  (global.URL as any).revokeObjectURL = vi.fn();
  mockUploadImage.mockImplementation(async (file: File) => ({ url: `https://bucket/${file.name}` }));
});

afterEach(() => {
  vi.clearAllMocks();
  delete (global as any).fetch;
});

// --- photos -------------------------------------------------------------------

const deletes = () => ((global as any).fetch as Mock).mock.calls.filter(([, options]) => options?.method === "DELETE");

/**
 * The × on the review's photo, and Remove when it asks, once the form is up.
 * Not async: awaiting it would let the DELETE's answer arrive outside act.
 */
function removeExistingPhoto() {
  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  const question = screen.getByRole("group", { name: "Remove photo 1?" });
  fireEvent.click(within(question).getByRole("button", { name: "Remove" }));
}

test("while a photo is being removed, the review can't be saved", async () => {
  let answer: (value: any) => void = () => {};
  serve((_url, options) => options.method === "DELETE"
    ? new Promise((resolve) => { answer = resolve; })
    : okJson({}));
  renderForm();
  await screen.findByRole("button", { name: "Remove photo 1" });

  removeExistingPhoto();

  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await act(async () => answer(okJson({ message: "Successfully deleted" })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled());
});

test("a photo the review already has is removed once asked and answered, without waiting for Submit", async () => {
  serve((_url, options) => options.method === "DELETE" ? okJson({ message: "Successfully deleted" }) : okJson({}));
  renderForm();
  expect(await screen.findByAltText("Already on this review, 1 of 1")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  expect(deletes()).toEqual([]);
  fireEvent.click(within(screen.getByRole("group", { name: "Remove photo 1?" })).getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(screen.queryByAltText("Already on this review, 1 of 1")).not.toBeInTheDocument());
  expect((global as any).fetch).toHaveBeenCalledWith(`/api/review-images/${EXISTING}`, { method: "DELETE" });
  expect(mockReplace).not.toHaveBeenCalled(); // no Submit needed
});

test("removing a photo keeps what has been typed", async () => {
  serve((_url, options) => options.method === "DELETE" ? okJson({ message: "Successfully deleted" }) : okJson({}));
  renderForm();

  fireEvent.change(await reviewBox(), { target: { value: "Better than I said." } });
  fireEvent.click(screen.getByRole("radio", { name: /^5 stars/ }));
  removeExistingPhoto();

  await waitFor(() => expect(screen.queryByAltText("Already on this review, 1 of 1")).not.toBeInTheDocument());
  expect(screen.getByRole("textbox")).toHaveValue("Better than I said.");
  expect(chosenRating()).toBe("5");
});

test("a removal the server refuses keeps the photo and says why", async () => {
  serve((_url, options) => options.method === "DELETE"
    ? refused(["You can only delete photos from your own review"], 403)
    : okJson({}));
  renderForm();
  await screen.findByRole("button", { name: "Remove photo 1" });

  removeExistingPhoto();

  expect(await screen.findByText("You can only delete photos from your own review")).toBeInTheDocument();
  // Whatever was still on its way has arrived: the question stays up.
  await act(async () => {});
  expect(screen.getByAltText("Already on this review, 1 of 1")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Remove photo 1?" })).toBeInTheDocument();
});

test("when some photos attach and some do not, only the failures stay staged", async () => {
  serve((_url, options) => {
    if (options.method === "PUT") return okJson({ ...review, review: "Better." });
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      return body.url.endsWith("b.png") ? refused(["Not today"]) : okJson({ id: 9 });
    }
    return okJson({});
  });
  renderForm();

  await reviewBox();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["x"], "a.png", { type: "image/png" }), new File(["x"], "b.png", { type: "image/png" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Your review was saved, but some photos could not be attached:")).toBeInTheDocument();
  expect(screen.getByText("b.png: Not today")).toBeInTheDocument();
  expect(screen.queryByAltText("a.png, not yet uploaded")).not.toBeInTheDocument();
  expect(screen.getByAltText("b.png, not yet uploaded")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();

  // Trying again sends only the one that failed.
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(attachCalls()).toEqual([
    "https://bucket/a.png", "https://bucket/b.png", "https://bucket/b.png",
  ]));
});

test("arriving from the create form shows why photos are missing", async () => {
  serve();
  renderForm({ state: { notice: ["Your review was posted, but some photos could not be attached:", "c.png: Not today"] } });

  expect(await screen.findByText("Your review was posted, but some photos could not be attached:")).toBeInTheDocument();
  expect(screen.getByText("c.png: Not today")).toBeInTheDocument();
});

// --- loading the review ---------------------------------------------------------

test("a review that isn't in the store is loaded and filled in", async () => {
  // Arriving from the profile page, or a review past the restaurant's first page.
  serve();
  renderForm();

  expect(await reviewBox()).toHaveValue("Solid.");
  expect(chosenRating()).toBe("4");
  expect(screen.getByRole("heading", { name: "Edit your review of Uchi" })).toBeInTheDocument();
});

test("the form is filled from the review as it is now, not as the store last saw it", async () => {
  serve(undefined, okJson({ ...review, review: "Edited elsewhere.", rating: 2 }));
  renderForm({ stored: { [REVIEW]: review } });

  expect(await reviewBox()).toHaveValue("Edited elsewhere.");
  expect(chosenRating()).toBe("2");
});

test("saving goes back to the restaurant, replacing the form in the history", async () => {
  serve((_url, options) => options.method === "PUT" ? okJson({ ...review, review: "Better." }) : okJson({}));
  renderForm();

  fireEvent.change(await reviewBox(), { target: { value: "Better." } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockPush).not.toHaveBeenCalled();
});

// --- who gets a form ------------------------------------------------------------------

async function expectNotFound() {
  expect(await screen.findByRole("heading", { name: "We couldn't find that review." })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse restaurants" })).toHaveAttribute("href", "/restaurants");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove photo 1" })).not.toBeInTheDocument();
}

test("someone else's review is not offered for editing", async () => {
  serve();
  renderForm({ user: { ...AUTHOR, id: 7 } });
  await expectNotFound();
});

test("a review that isn't there gets the not-found page, not an empty form", async () => {
  serve(undefined, refused(["Review couldn't be found"], 404));
  renderForm();
  await expectNotFound();
});

test("a review from another restaurant is not found at this one", async () => {
  serve();
  renderForm({ path: `/1/reviews/${REVIEW}/update` });
  await expectNotFound();
});

test("a reader who is not logged in is asked to", async () => {
  serve();
  renderForm({ user: null });

  expect(await screen.findByRole("heading", { name: "Log in to edit your review" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  // And logging in comes back here (#135).
  fireEvent.click(screen.getByRole("link", { name: "Log in" }));
  expect(where.pathname).toBe("/login");
  expect(where.state).toEqual({ from: `/${RESTAURANT}/reviews/${REVIEW}/update` });
});

// --- what a screen reader gets (#122) ------------------------------------------------

test("the form is headed as the page, and why photos are missing is announced", async () => {
  serve();
  const { container } = renderForm({ state: { notice: ["Your review was posted, but some photos could not be attached:"] } });
  await reviewBox();

  expect(screen.getByRole("heading", { level: 1, name: "Edit your review of Uchi" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("some photos could not be attached");
  expect(await axe(container)).toHaveNoViolations();
});

test("the edit form's tab names the restaurant", async () => {
  serve();
  renderForm();
  await reviewBox();
  expect(document.title).toBe("Edit your review: Uchi · Whelp");
});

// --- the form itself (#132) -----------------------------------------------------

test("the whole review shows, in a box to edit, under the restaurant it's about", async () => {
  // A one-line box cut this off at "Environment is casu".
  const long = "It lives UP to the hype. Environment is casual but the food is anything but: every course "
    + "of the omakase was better than the last, and the service was warm without hovering.";
  serve(undefined, okJson({
    ...review, review: long,
    restaurant: { ...review.restaurant, city: "Austin", state: "TX", previewImage: "https://img/uchi.jpg" },
  }));
  renderForm();

  const box = await reviewBox();
  expect(box.tagName).toBe("TEXTAREA");
  expect(box).toHaveValue(long);
  expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  expect(document.querySelector(".review-form-cover")).toHaveAttribute("src", "https://img/uchi.jpg");
  expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/single/${RESTAURANT}`);
});

test("saving sends the stars as they are now", async () => {
  serve((_url, options) => options.method === "PUT" ? okJson({ ...review, rating: 2 }) : okJson({}));
  renderForm();
  await reviewBox();

  fireEvent.click(screen.getByRole("radio", { name: /^2 stars/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  const [, saved] = ((global as any).fetch as Mock).mock.calls.find(([, options]) => options?.method === "PUT")!;
  expect(JSON.parse(saved.body)).toEqual({ review: "Solid.", rating: 2 });
});
