import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import restaurantsReducer from "../../../store/restaurants";
import CreateNewReview from "./index";

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
const NEW_REVIEW = 42;

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (errors: string[]) => ({ ok: false, status: 400, json: () => Promise.resolve({ errors }) });

/** Every request the form made, in order, as "METHOD url". */
const requests = () =>
  ((global as any).fetch as jest.Mock).mock.calls.map(([url, options]) => `${options?.method ?? "GET"} ${url}`);

function serve(overrides: { attach?: any } = {}) {
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    if (options.method === "POST" && url === `/api/restaurants/${RESTAURANT}/reviews`) {
      return Promise.resolve(okJson({ id: NEW_REVIEW, review: "Great", rating: 5, restaurant_id: RESTAURANT }));
    }
    if (options.method === "POST" && url === `/api/reviews/${NEW_REVIEW}/images`) {
      return Promise.resolve(overrides.attach ?? okJson({ id: 1 }));
    }
    if (url.startsWith(`/api/restaurants/${RESTAURANT}/reviews`)) {
      return Promise.resolve(okJson({ items: [], page: 1, per_page: 20, total: 0 }));
    }
    return Promise.resolve(okJson({ id: RESTAURANT, restaurantImages: [], categories: [] }));
  });
}

function renderForm() {
  const store = createStore(
    combineReducers({ reviews: reviewReducer, Restaurants: restaurantsReducer }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[`/${RESTAURANT}/create-review`]}>
        <Route path="/:restaurantId/create-review">
          <CreateNewReview />
        </Route>
      </MemoryRouter>
    </Provider>
  );
}

function writeReview(...photos: string[]) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Great" } });
  if (photos.length) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: photos.map((name) => new File(["x"], name, { type: "image/png" })) },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
}

beforeEach(() => {
  (global.URL as any).createObjectURL = jest.fn(() => "blob:preview");
  (global.URL as any).revokeObjectURL = jest.fn();
  mockUploadImage.mockImplementation(async (file: File) => ({ url: `https://bucket/uploads/2/${file.name}` }));
});

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("photos go up first, then the review, then each photo onto it", async () => {
  serve();
  renderForm();

  writeReview("a.png", "b.png");

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockUploadImage.mock.calls.map(([file]) => file.name)).toEqual(["a.png", "b.png"]);

  const writes = requests().filter((request) => request.startsWith("POST"));
  expect(writes).toEqual([
    `POST /api/restaurants/${RESTAURANT}/reviews`,
    `POST /api/reviews/${NEW_REVIEW}/images`,
    `POST /api/reviews/${NEW_REVIEW}/images`,
  ]);

  const attached = ((global as any).fetch as jest.Mock).mock.calls
    .filter(([url]) => url === `/api/reviews/${NEW_REVIEW}/images`)
    .map(([, options]) => JSON.parse(options.body).url);
  expect(attached).toEqual(["https://bucket/uploads/2/a.png", "https://bucket/uploads/2/b.png"]);
});

test("a photo the server refuses stops everything before the review is posted", async () => {
  serve();
  mockUploadImage.mockResolvedValueOnce({ errors: ["Images must be smaller than 5 MB."] });
  renderForm();

  writeReview("big.png");

  expect(await screen.findByText("big.png: Images must be smaller than 5 MB.")).toBeInTheDocument();
  expect(requests().filter((request) => request.startsWith("POST"))).toEqual([]);
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
});

test("a photo that will not attach sends the reader to the edit page, saying why", async () => {
  serve({ attach: refused(["Maximum number of images for this resource was reached"]) });
  renderForm();

  writeReview("a.png");

  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  const [path, state] = mockPush.mock.calls[0];
  expect(path).toBe(`/${RESTAURANT}/reviews/${NEW_REVIEW}/update`);
  expect(state.notice[0]).toBe("Your review was posted, but some photos could not be attached:");
  expect(state.notice[1]).toContain("a.png");
});

test("a review without photos uploads nothing", async () => {
  serve();
  renderForm();

  writeReview();

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/single/${RESTAURANT}`));
  expect(mockUploadImage).not.toHaveBeenCalled();
  expect(requests().filter((request) => request.includes("/images"))).toEqual([]);
});

test("a refused review is shown, and nothing is attached", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(refused(["User already has a review for this restaurant"])));
  renderForm();

  writeReview("a.png");

  expect(await screen.findByText("User already has a review for this restaurant")).toBeInTheDocument();
  expect(requests().filter((request) => request.includes("/images"))).toEqual([]);
  expect(mockPush).not.toHaveBeenCalled();
});
