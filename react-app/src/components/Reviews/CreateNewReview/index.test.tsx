import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route, matchPath } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import restaurantsReducer from "../../../store/restaurants";
import { CREATE_REVIEW_PATH, UPDATE_REVIEW_PATH } from "../paths";
import CreateNewReview from "./index";
import { axe } from "../../../testUtils/axe";
import type { Mock } from "vitest";

/**
 * Posting a review with photos is three steps, and their order is the point:
 *
 *   1. upload the photos     -- what realistically fails, so it goes first
 *   2. post the review       -- only once every photo is safely up
 *   3. attach each photo     -- which needs the review's id
 *
 * A failed upload therefore leaves no review behind, and a failed attach --
 * after the review exists -- hands over to the edit page rather than letting
 * the reader resubmit and be told they have already reviewed.
 *
 * Before any of that, the page loads the restaurant: a form is only offered
 * to someone the server would take a review from (#112).
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
const NEW_REVIEW = 42;
const OWNER = 1;
const READER = { id: 7, username: "reader", first_name: "Rea", last_name: "Der" };

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (errors: string[], status = 400) => ({ ok: false, status, json: () => Promise.resolve({ errors }) });

const restaurant = (overrides: any = {}) => ({
  id: RESTAURANT, user_id: OWNER, name: "Uchi", restaurantImages: [], categories: [],
  viewerReviewId: null, ...overrides,
});

/** Every request the form made, in order, as "METHOD url". */
const requests = () =>
  ((global as any).fetch as Mock).mock.calls.map(([url, options]) => `${options?.method ?? "GET"} ${url}`);

function serve(overrides: { attach?: any; post?: any; restaurant?: any } = {}) {
  (global as any).fetch = vi.fn((url: string, options: any = {}) => {
    if (options.method === "POST" && url === `/api/restaurants/${RESTAURANT}/reviews`) {
      return Promise.resolve(overrides.post
        ?? okJson({ id: NEW_REVIEW, review: "Great", rating: 5, restaurant_id: RESTAURANT }));
    }
    if (options.method === "POST" && url === `/api/reviews/${NEW_REVIEW}/images`) {
      return Promise.resolve(overrides.attach ?? okJson({ id: 1 }));
    }
    if (url === `/api/restaurants/${RESTAURANT}`) {
      return Promise.resolve(overrides.restaurant ?? okJson(restaurant()));
    }
    return Promise.resolve(refused(["unexpected request"], 500));
  });
}

let router: any;

function renderForm(user: any = READER) {
  const store = createStore(
    combineReducers({
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
      session: (state = { user }) => state,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[`/single/${RESTAURANT}`, `/${RESTAURANT}/create-review`]} initialIndex={1}>
        <Route path={CREATE_REVIEW_PATH}>
          <CreateNewReview />
        </Route>
        <Route path={UPDATE_REVIEW_PATH}>
          <p>The edit page</p>
        </Route>
        <Route path="*" render={(props) => { router = props.history; return null; }} />
      </MemoryRouter>
    </Provider>
  );
}

async function writeReview(...photos: string[]) {
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Great" } });
  fireEvent.click(screen.getByRole("radio", { name: /^5 stars/ }));
  if (photos.length) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: photos.map((name) => new File(["x"], name, { type: "image/png" })) },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));
}

beforeEach(() => {
  (global.URL as any).createObjectURL = vi.fn(() => "blob:preview");
  (global.URL as any).revokeObjectURL = vi.fn();
  mockUploadImage.mockImplementation(async (file: File) => ({ url: `https://bucket/uploads/2/${file.name}` }));
});

afterEach(() => {
  vi.clearAllMocks();
  delete (global as any).fetch;
});

// --- posting ------------------------------------------------------------------

test("photos go up first, then the review, then each photo onto it", async () => {
  serve();
  renderForm();

  await writeReview("a.png", "b.png");

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockUploadImage.mock.calls.map(([file]) => file.name)).toEqual(["a.png", "b.png"]);

  const writes = requests().filter((request) => !request.startsWith("GET"));
  expect(writes).toEqual([
    `POST /api/restaurants/${RESTAURANT}/reviews`,
    `POST /api/reviews/${NEW_REVIEW}/images`,
    `POST /api/reviews/${NEW_REVIEW}/images`,
  ]);

  const attached = ((global as any).fetch as Mock).mock.calls
    .filter(([url]) => url === `/api/reviews/${NEW_REVIEW}/images`)
    .map(([, options]) => JSON.parse(options.body).url);
  expect(attached).toEqual(["https://bucket/uploads/2/a.png", "https://bucket/uploads/2/b.png"]);
});

test("a posted review replaces the form in the history, so Back skips it", async () => {
  serve();
  renderForm();

  await writeReview();

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockPush).not.toHaveBeenCalled();
  // And nothing is refetched on the way: the restaurant page loads for itself.
  expect(requests().filter((request) => request.startsWith("GET"))).toEqual([`GET /api/restaurants/${RESTAURANT}`]);
});

test("a photo the server refuses stops everything before the review is posted", async () => {
  serve();
  mockUploadImage.mockResolvedValueOnce({ errors: ["Images must be smaller than 5 MB."] });
  renderForm();

  await writeReview("big.png");

  expect(await screen.findByText("big.png: Images must be smaller than 5 MB.")).toBeInTheDocument();
  expect(requests().filter((request) => request.startsWith("POST"))).toEqual([]);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Post review" })).not.toBeDisabled();
});

test("a photo that will not attach sends the reader to the edit page, saying why", async () => {
  serve({ attach: refused(["Maximum number of images for this resource was reached"]) });
  renderForm();

  await writeReview("a.png");

  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const [path, state] = mockReplace.mock.calls[0];
  expect(path).toBe(`/${RESTAURANT}/reviews/${NEW_REVIEW}/update`);
  expect(state.notice[0]).toBe("Your review was posted, but some photos could not be attached:");
  expect(state.notice[1]).toContain("a.png");
  expect(mockPush).not.toHaveBeenCalled();
});

test("a review without photos uploads nothing", async () => {
  serve();
  renderForm();

  await writeReview();

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockUploadImage).not.toHaveBeenCalled();
  expect(requests().filter((request) => request.includes("/images"))).toEqual([]);
});

test("a refused review is shown, and nothing is attached", async () => {
  serve({ post: refused(["You've already reviewed this restaurant"], 403) });
  renderForm();

  await writeReview("a.png");

  expect(await screen.findByText("You've already reviewed this restaurant")).toBeInTheDocument();
  expect(requests().filter((request) => request.includes("/images"))).toEqual([]);
  expect(mockReplace).not.toHaveBeenCalled();
});

// --- who gets a form ------------------------------------------------------------------

test("the form says which restaurant it is for", async () => {
  serve();
  renderForm();

  expect(await screen.findByRole("heading", { name: "Write a review for Uchi" })).toBeInTheDocument();
});

test("a restaurant that isn't there gets the not-found page, not a form", async () => {
  serve({ restaurant: refused(["Restaurant couldn't be found"], 404) });
  renderForm();

  expect(await screen.findByRole("heading", { name: "We couldn't find that restaurant." })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse restaurants" })).toHaveAttribute("href", "/restaurants");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("a reader who is not logged in is asked to, before writing anything", async () => {
  serve();
  renderForm(null);

  expect(await screen.findByRole("heading", { name: "Log in to write a review" })).toBeInTheDocument();
  expect(screen.getByText("You need an account to review Uchi.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  // And logging in comes back here (#135).
  fireEvent.click(screen.getByRole("link", { name: "Log in" }));
  expect(router.location.pathname).toBe("/login");
  expect(router.location.state).toEqual({ from: `/${RESTAURANT}/create-review` });
});

test("the owner is told they can't review their own restaurant", async () => {
  serve();
  renderForm({ ...READER, id: OWNER });

  expect(await screen.findByRole("heading", { name: "You can't review your own restaurant" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to Uchi" })).toHaveAttribute("href", `/single/${RESTAURANT}`);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("someone who has reviewed it already is taken to their review, in place of the form", async () => {
  serve({ restaurant: okJson(restaurant({ viewerReviewId: 9 })) });
  renderForm();

  expect(await screen.findByText("The edit page")).toBeInTheDocument();
  expect(router.location.pathname).toBe(`/${RESTAURANT}/reviews/9/update`);
  // Replaced, not pushed: Back goes to the restaurant, not to a redirect.
  expect(router.action).toBe("REPLACE");
  expect(router.length).toBe(2);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("the route takes restaurant ids only", () => {
  expect(matchPath(`/${RESTAURANT}/create-review`, { path: CREATE_REVIEW_PATH, exact: true })).not.toBeNull();
  expect(matchPath("/foo/create-review", { path: CREATE_REVIEW_PATH, exact: true })).toBeNull();
  expect(matchPath("/3/reviews/6/update", { path: UPDATE_REVIEW_PATH, exact: true })).not.toBeNull();
  expect(matchPath("/3/reviews/abc/update", { path: UPDATE_REVIEW_PATH, exact: true })).toBeNull();
  expect(matchPath("/foo/reviews/6/update", { path: UPDATE_REVIEW_PATH, exact: true })).toBeNull();
});

// --- what a screen reader gets (#122) ------------------------------------------------

test("the form is headed as the page, and a refusal is announced", async () => {
  serve({ post: refused(["You've already reviewed this restaurant"], 403) });
  const { container } = renderForm();
  expect(await screen.findByRole("heading", { level: 1, name: "Write a review for Uchi" })).toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();

  await writeReview();
  expect(await screen.findByRole("alert")).toHaveTextContent("You've already reviewed this restaurant");
  expect(await axe(container)).toHaveNoViolations();
});

test("the form's tab names the restaurant, and a prompt's tab is the prompt", async () => {
  serve();
  const { unmount } = renderForm();
  await screen.findByRole("heading", { level: 1, name: "Write a review for Uchi" });
  expect(document.title).toBe("Write a review: Uchi · Whelp");
  unmount();

  serve();
  renderForm(null);
  await screen.findByRole("heading", { name: "Log in to write a review" });
  expect(document.title).toBe("Log in to write a review · Whelp");
});

// --- the form itself (#132) -----------------------------------------------------

test("the rating starts empty, and a review without one is not sent", async () => {
  serve();
  renderForm();
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Great" } });
  expect((screen.getAllByRole("radio") as HTMLInputElement[]).some((star) => star.checked)).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a rating, from one to five stars.");
  expect(requests()).toEqual([`GET /api/restaurants/${RESTAURANT}`]);
});

test("what is posted is the words, trimmed, and the stars chosen", async () => {
  serve();
  renderForm();
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: "  Great  " } });
  fireEvent.click(screen.getByRole("radio", { name: /^2 stars/ }));

  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  const [, posted] = ((global as any).fetch as Mock).mock.calls
    .find(([url, options]) => options?.method === "POST" && url === `/api/restaurants/${RESTAURANT}/reviews`)!;
  expect(JSON.parse(posted.body)).toEqual({ review: "Great", rating: 2 });
});

test("the header shows the restaurant's cover photo and where it is, and Cancel goes back to it", async () => {
  serve({
    restaurant: okJson(restaurant({
      city: "Austin", state: "TX",
      restaurantImages: [{ id: 1, url: "https://img/first.jpg", preview: false }, { id: 2, url: "https://img/cover.jpg", preview: true }],
    })),
  });
  renderForm();

  await screen.findByRole("heading", { level: 1, name: "Write a review for Uchi" });
  expect(document.querySelector(".review-form-cover")).toHaveAttribute("src", "https://img/cover.jpg");
  expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/single/${RESTAURANT}`);
});
