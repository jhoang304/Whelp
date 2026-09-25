import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import categoriesReducer from "../../store/categories";
import CreateRestaurantModal from "./index";

/**
 * What creating a restaurant does, written before #61 pulls the ten fields
 * out into a shared form: the edit modal had tests to refactor against and
 * this one did not, and a refactor is only as safe as the behaviour someone
 * wrote down first.
 *
 * The create flow is two requests, not one -- the restaurant, then its cover
 * photo -- and a third before either if the photo is being uploaded rather
 * than linked.
 */

const mockCloseModal = jest.fn();
jest.mock("../../context/Modal", () => ({
  useModal: () => ({ closeModal: mockCloseModal }),
}));

const mockPush = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useHistory: () => ({ push: mockPush }),
}));

const mockUploadImage = jest.fn();
jest.mock("../../utils/uploads", () => ({
  ...jest.requireActual("../../utils/uploads"),
  uploadImage: (file: File) => mockUploadImage(file),
}));

const okJson = (body: any, status = 200) => ({
  ok: true,
  status,
  json: () => Promise.resolve(body),
});

function renderModal() {
  const store = createStore(
    combineReducers({
      session: (state = { user: { id: 1 } }) => state,
      Restaurants: restaurantsReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <CreateRestaurantModal />
      </MemoryRouter>
    </Provider>
  );
}

const submitButton = () => screen.getByRole("button", { name: /create restaurant|creating/i });

/** Fill every required field with something valid. */
function fillTheForm() {
  // By label, the way a screen reader finds them: the placeholders that used
  // to name these fields were gone the moment anyone typed.
  const type = (label: RegExp | string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  type("Business name", "New Bistro");
  type("Street address", "9 New St");
  type("City", "Austin");
  type("State", "TX");
  type("ZIP code", "78701");
  type("Country", "USA");
  type("Phone", "(555) 999-0000");
  type("Website", "http://new.com");
  type("Description", "Brand new.");

  // A pasted URL rather than an upload, so the file input is out of the way.
  fireEvent.click(screen.getByRole("button", { name: /image url/i }));
  type(/Cover image URL/i, "https://example.com/cover.jpg");
}

/** The bodies of the JSON requests the modal sent, by URL. */
function sentJson() {
  return ((global as any).fetch as jest.Mock).mock.calls
    .filter(([, options]) => options?.body && typeof options.body === "string")
    .map(([url, options]) => ({ url, body: JSON.parse(options.body) }));
}

beforeEach(() => {
  // The cover preview draws a chosen file through a blob: url, which jsdom
  // does not implement.
  (global.URL as any).createObjectURL = jest.fn(() => "blob:cover");
  (global.URL as any).revokeObjectURL = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("a valid submission creates the restaurant, attaches the cover photo, and opens its page", async () => {
  (global as any).fetch = jest.fn((url: string) =>
    Promise.resolve(url === "/api/restaurants/" ? okJson({ id: 7 }) : okJson({ id: 3, preview: true }))
  );

  renderModal();
  fillTheForm();
  fireEvent.click(submitButton());

  await waitFor(() => expect(mockCloseModal).toHaveBeenCalledTimes(1));

  const [restaurant, image] = sentJson();
  expect(restaurant.url).toBe("/api/restaurants/");
  expect(restaurant.body).toMatchObject({
    name: "New Bistro",
    city: "Austin",
    zipcode: "78701",
    website: "http://new.com",
  });
  expect(restaurant.body.user_id).toBeUndefined(); // the API takes the owner from the session
  expect(image.url).toBe("/api/restaurants/7/images");
  expect(image.body).toEqual({ url: "https://example.com/cover.jpg", preview: true });
  expect(mockPush).toHaveBeenCalledWith("/single/7");
});

test("the cuisines picked are sent with the restaurant", async () => {
  (global as any).fetch = jest.fn((url: string) => {
    if (url === "/api/categories/") return Promise.resolve(okJson({ items: [
      { id: 4, name: "Pizza", slug: "pizza" },
      { id: 9, name: "Italian", slug: "italian" },
    ] }));
    return Promise.resolve(url === "/api/restaurants/" ? okJson({ id: 7 }) : okJson({ id: 3 }));
  });

  renderModal();
  fillTheForm();
  fireEvent.click(await screen.findByRole("button", { name: "Pizza" }));
  fireEvent.click(screen.getByRole("button", { name: "Italian" }));
  fireEvent.click(submitButton());

  await waitFor(() => expect(mockCloseModal).toHaveBeenCalled());
  expect(sentJson()[0].body.category_ids).toEqual([4, 9]);
});

test("client-side validation blocks the request entirely", async () => {
  (global as any).fetch = jest.fn();

  renderModal();
  fireEvent.click(submitButton()); // nothing filled in

  expect(await screen.findByText("Restaurant name is required")).toBeInTheDocument();
  expect(sentJson()).toHaveLength(0);
  expect(mockCloseModal).not.toHaveBeenCalled();
});

test("a cover photo is required before anything is created", async () => {
  (global as any).fetch = jest.fn();

  renderModal();
  fillTheForm();
  fireEvent.change(screen.getByLabelText(/Cover image URL/i), { target: { value: "" } });
  fireEvent.click(submitButton());

  expect(await screen.findByText("Cover photo URL is required")).toBeInTheDocument();
  expect(sentJson()).toHaveLength(0);
});

test("a failed upload stops before the restaurant is created", async () => {
  (global as any).fetch = jest.fn();
  mockUploadImage.mockResolvedValue({ errors: ["Images must be smaller than 5 MB."] });

  renderModal();
  fillTheForm();
  // back to the upload tab, with a file chosen
  fireEvent.click(screen.getByRole("button", { name: /upload cover photo/i }));
  const file = new File(["x"], "cover.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText(/choose photo/i, { selector: "input[type=file]" }), {
    target: { files: [file] },
  });
  fireEvent.click(submitButton());

  expect(await screen.findByText("Images must be smaller than 5 MB.")).toBeInTheDocument();
  expect(sentJson()).toHaveLength(0);
  expect(mockCloseModal).not.toHaveBeenCalled();
  expect(submitButton()).not.toBeDisabled(); // and you can try again
});

test("the server's errors are shown and the modal stays open", async () => {
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ errors: ["Postal code must be between 3 and 10 characters."] }),
    })
  );

  renderModal();
  fillTheForm();
  fireEvent.click(submitButton());

  expect(await screen.findByText("Postal code must be between 3 and 10 characters.")).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(submitButton()).not.toBeDisabled();
});

test("a dropped connection is reported instead of stranding the form", async () => {
  (global as any).fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));

  renderModal();
  fillTheForm();
  fireEvent.click(submitButton());

  expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();
  expect(submitButton()).not.toBeDisabled();
});

test("the cover photo is previewed once there is one to show", () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({})));
  renderModal();
  const preview = () => document.querySelector(".image-picker-preview img");
  expect(preview()).toBeNull();

  fireEvent.change(screen.getByLabelText(/choose photo/i, { selector: "input[type=file]" }), {
    target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
  });
  expect(preview()).toHaveAttribute("src", "blob:cover");
  expect(screen.getByText("cover.png")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /image url/i }));
  fireEvent.change(screen.getByLabelText(/Cover image URL/i), { target: { value: "not a url" } });
  expect(preview()).toBeNull();
  fireEvent.change(screen.getByLabelText(/Cover image URL/i), { target: { value: "https://example.com/c.jpg" } });
  expect(preview()).toHaveAttribute("src", "https://example.com/c.jpg");
});
