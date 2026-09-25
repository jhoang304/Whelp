import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import restaurantsReducer from "../../../store/restaurants";
import UpdateReview from "./index";

/**
 * The edit form, where a review's photos can go as well as come.
 *
 * Removing one it already has is its own request and takes effect at once.
 * Adding follows the create form -- upload, save, attach -- and when some
 * attach and some do not, only the failures stay staged, so trying again
 * cannot put the others on the review twice.
 */

const mockPush = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useHistory: () => ({ push: mockPush }),
}));

const mockUploadImage = jest.fn();
jest.mock("../../../utils/uploads", () => ({
  ...jest.requireActual("../../../utils/uploads"),
  uploadImage: (file: File) => mockUploadImage(file),
}));

const RESTAURANT = 3;
const REVIEW = 42;
const EXISTING = 5;

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (errors: string[]) => ({ ok: false, status: 400, json: () => Promise.resolve({ errors }) });

const review = {
  id: REVIEW, user_id: 2, restaurant_id: RESTAURANT, review: "Solid.", rating: 4,
  createdAt: "", updatedAt: "",
  reviewImages: [{ id: EXISTING, review_id: REVIEW, url: "https://bucket/old.png", createdAt: "", updatedAt: "" }],
};

function renderForm(state?: any) {
  const store = createStore(
    combineReducers({ reviews: reviewReducer, Restaurants: restaurantsReducer }),
    { reviews: { [REVIEW]: review } } as any,
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[{ pathname: `/${RESTAURANT}/reviews/${REVIEW}/update`, state }]}>
        <Route path="/:restaurantId/reviews/:reviewId/update">
          <UpdateReview />
        </Route>
      </MemoryRouter>
    </Provider>
  );
}

const attachCalls = () =>
  ((global as any).fetch as jest.Mock).mock.calls
    .filter(([url, options]) => options?.method === "POST" && url === `/api/reviews/${REVIEW}/images`)
    .map(([, options]) => JSON.parse(options.body).url);

beforeEach(() => {
  let n = 0;
  (global.URL as any).createObjectURL = jest.fn(() => `blob:${n++}`);
  (global.URL as any).revokeObjectURL = jest.fn();
  mockUploadImage.mockImplementation(async (file: File) => ({ url: `https://bucket/${file.name}` }));
});

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("a photo the review already has is removed at once", async () => {
  (global as any).fetch = jest.fn((_url: string, options: any = {}) =>
    Promise.resolve(options.method === "DELETE" ? okJson({ message: "Successfully deleted" }) : okJson({ items: [] })));
  renderForm();
  expect(screen.getByAltText("Already on this review, 1 of 1")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));

  await waitFor(() => expect(screen.queryByAltText("Already on this review, 1 of 1")).not.toBeInTheDocument());
  expect((global as any).fetch).toHaveBeenCalledWith(`/api/review-images/${EXISTING}`, { method: "DELETE" });
  expect(mockPush).not.toHaveBeenCalled(); // no Submit needed
});

test("a removal the server refuses keeps the photo and says why", async () => {
  (global as any).fetch = jest.fn((_url: string, options: any = {}) =>
    Promise.resolve(options.method === "DELETE"
      ? { ok: false, status: 403, json: () => Promise.resolve({ errors: ["You can only delete photos from your own review"] }) }
      : okJson({ items: [] })));
  renderForm();

  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));

  expect(await screen.findByText("You can only delete photos from your own review")).toBeInTheDocument();
  expect(screen.getByAltText("Already on this review, 1 of 1")).toBeInTheDocument();
});

test("when some photos attach and some do not, only the failures stay staged", async () => {
  (global as any).fetch = jest.fn((_url: string, options: any = {}) => {
    if (options.method === "PUT") return Promise.resolve(okJson({ ...review, review: "Better." }));
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      return Promise.resolve(body.url.endsWith("b.png") ? refused(["Not today"]) : okJson({ id: 9 }));
    }
    return Promise.resolve(okJson({ items: [], id: RESTAURANT, restaurantImages: [], categories: [] }));
  });
  renderForm();

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["x"], "a.png", { type: "image/png" }), new File(["x"], "b.png", { type: "image/png" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));

  expect(await screen.findByText("Your review was saved, but some photos could not be attached:")).toBeInTheDocument();
  expect(screen.getByText("b.png: Not today")).toBeInTheDocument();
  expect(screen.queryByAltText("a.png, not yet uploaded")).not.toBeInTheDocument();
  expect(screen.getByAltText("b.png, not yet uploaded")).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();

  // Trying again sends only the one that failed.
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => expect(attachCalls()).toEqual([
    "https://bucket/a.png", "https://bucket/b.png", "https://bucket/b.png",
  ]));
});

test("arriving from the create form shows why photos are missing", () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ items: [] })));
  renderForm({ notice: ["Your review was posted, but some photos could not be attached:", "c.png: Not today"] });

  expect(screen.getByText("Your review was posted, but some photos could not be attached:")).toBeInTheDocument();
  expect(screen.getByText("c.png: Not today")).toBeInTheDocument();
});
