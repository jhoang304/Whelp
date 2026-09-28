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
 * The create flow is one request -- the restaurant and its cover photo
 * together, which the API writes in one commit -- and an upload before it
 * if the photo is being uploaded rather than linked. It used to be two, and
 * a cover that failed after the restaurant was saved left the form open to
 * make another restaurant on every retry (#114).
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

test("a valid submission creates the restaurant with its cover, in one request, and opens its page", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ id: 7 })));

  renderModal();
  fillTheForm();
  fireEvent.click(submitButton());

  await waitFor(() => expect(mockCloseModal).toHaveBeenCalledTimes(1));

  const sent = sentJson();
  expect(sent.map((request) => request.url)).toEqual(["/api/restaurants/"]); // no second request for the photo
  expect(sent[0].body).toMatchObject({
    name: "New Bistro",
    city: "Austin",
    zipcode: "78701",
    website: "http://new.com",
    url: "https://example.com/cover.jpg",
  });
  expect(sent[0].body.user_id).toBeUndefined(); // the API takes the owner from the session
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

// --- trying again after a refusal (#114) ------------------------------------------

const refused = (errors: string[]) => ({ ok: false, status: 400, json: () => Promise.resolve({ errors }) });

/** Answer each create with the next of `answers`; the form's own lists with nothing. */
function answerCreates(...answers: any[]) {
  (global as any).fetch = jest.fn((url: string, options: any = {}) =>
    Promise.resolve(options.method === "POST" && url === "/api/restaurants/" ? answers.shift() : okJson({ items: [] })));
}

test("a refused create made nothing, so trying again is one restaurant, not two", async () => {
  answerCreates(refused(["Image URL must be 255 characters or fewer."]), okJson({ id: 8 }));

  renderModal();
  fillTheForm();
  fireEvent.click(submitButton());

  expect(await screen.findByText("Image URL must be 255 characters or fewer.")).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();

  fireEvent.click(submitButton());
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/single/8"));
  // One create per click, and never a separate photo request that could fail
  // after the restaurant was saved.
  expect(sentJson().map((request) => request.url)).toEqual(["/api/restaurants/", "/api/restaurants/"]);
});

test("a pasted link longer than the API takes is caught before anything is sent", async () => {
  (global as any).fetch = jest.fn();

  renderModal();
  fillTheForm();
  fireEvent.change(screen.getByLabelText(/Cover image URL/i), {
    target: { value: "https://cdn.example.com/" + "a".repeat(300) + ".jpg" },
  });
  fireEvent.click(submitButton());

  expect(await screen.findByText("Image URL must be 255 characters or fewer.")).toBeInTheDocument();
  expect(sentJson()).toHaveLength(0);
});

test("a link may say HTTPS in capitals, as the API allows", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ id: 7 })));

  renderModal();
  fillTheForm();
  fireEvent.change(screen.getByLabelText(/Cover image URL/i), { target: { value: "HTTPS://Example.com/c.jpg" } });
  fireEvent.click(submitButton());

  await waitFor(() => expect(mockCloseModal).toHaveBeenCalled());
  expect(sentJson()[0].body.url).toBe("HTTPS://Example.com/c.jpg");
});

test("an uploaded cover is not uploaded again when the create is retried", async () => {
  answerCreates(refused(["Postal code must be between 3 and 10 characters."]), okJson({ id: 9 }));
  mockUploadImage.mockResolvedValue({ url: "https://bucket/uploads/1/cover.png" });

  renderModal();
  fillTheForm();
  fireEvent.click(screen.getByRole("button", { name: /upload cover photo/i }));
  const chooser = () => screen.getByLabelText(/choose (a different )?photo/i, { selector: "input[type=file]" });
  fireEvent.change(chooser(), { target: { files: [new File(["x"], "cover.png", { type: "image/png" })] } });
  fireEvent.click(submitButton());
  expect(await screen.findByText("Postal code must be between 3 and 10 characters.")).toBeInTheDocument();

  fireEvent.click(submitButton());
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/single/9"));
  expect(mockUploadImage).toHaveBeenCalledTimes(1);
  expect(sentJson().map((request) => request.body.url)).toEqual([
    "https://bucket/uploads/1/cover.png", "https://bucket/uploads/1/cover.png",
  ]);
});

test("a different file chosen after a refusal is uploaded", async () => {
  answerCreates(refused(["Postal code must be between 3 and 10 characters."]), okJson({ id: 9 }));
  mockUploadImage.mockImplementation(async (file: File) => ({ url: `https://bucket/uploads/1/${file.name}` }));

  renderModal();
  fillTheForm();
  fireEvent.click(screen.getByRole("button", { name: /upload cover photo/i }));
  const chooser = () => screen.getByLabelText(/choose (a different )?photo/i, { selector: "input[type=file]" });
  fireEvent.change(chooser(), { target: { files: [new File(["x"], "first.png", { type: "image/png" })] } });
  fireEvent.click(submitButton());
  expect(await screen.findByText("Postal code must be between 3 and 10 characters.")).toBeInTheDocument();

  fireEvent.change(chooser(), { target: { files: [new File(["y"], "second.png", { type: "image/png" })] } });
  fireEvent.click(submitButton());
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/single/9"));
  expect(mockUploadImage.mock.calls.map(([file]) => file.name)).toEqual(["first.png", "second.png"]);
  expect(sentJson()[1].body.url).toBe("https://bucket/uploads/1/second.png");
});
