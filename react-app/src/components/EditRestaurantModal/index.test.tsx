import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import restaurantsReducer from "../../store/restaurants";
import EditRestaurant from "./index";

/**
 * The save lifecycle, which is what this component gets wrong when it
 * regresses: the modal used to call `.then(closeModal())`, closing before the
 * PUT resolved, and its `.catch` could never fire because the thunk returned
 * undefined instead of throwing. Backend tests cannot see any of that.
 */

// Jest hoists jest.mock above the file, so the spy must be `mock`-prefixed.
const mockCloseModal = jest.fn();
jest.mock("../../context/Modal", () => ({
  useModal: () => ({ closeModal: mockCloseModal }),
}));

const OWNER_ID = 3;

const restaurant = {
  id: 7,
  user_id: OWNER_ID,
  name: "Test Bistro",
  price: "$$",
  address: "1 Main St",
  city: "Houston",
  state: "TX",
  zipcode: "77001",
  country: "USA",
  phone_number: "(555) 555-5555",
  website: "http://testbistro.com",
  description: "A place for tests.",
};

function renderModal(userId: number | null = OWNER_ID) {
  const store = createStore(
    combineReducers({
      session: (state = { user: userId === null ? null : { id: userId } }) => state,
      Restaurants: restaurantsReducer,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <EditRestaurant singleRestaurant={restaurant} />
    </Provider>
  );
}

const submitButton = () => screen.getByRole("button", { name: /submit|saving/i });

/** A promise whose resolution this test controls, to observe the in-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("the modal stays open until the PUT resolves, then closes", async () => {
  const put = deferred<any>();
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    if (options.method === "PUT") return put.promise;
    return Promise.resolve(okJson(restaurant)); // the refetch after a save
  });

  renderModal();
  fireEvent.click(submitButton());

  // In flight: still open, button disabled and showing progress.
  await waitFor(() => expect(submitButton()).toBeDisabled());
  expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();

  put.resolve(okJson({ ...restaurant, name: "Renamed Bistro" }));

  await waitFor(() => expect(mockCloseModal).toHaveBeenCalledTimes(1));
});

test("a rejected save shows the server's errors and keeps the modal open", async () => {
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ errors: ["You can only edit your own restaurants"] }),
    })
  );

  renderModal();
  fireEvent.click(submitButton());

  expect(await screen.findByText("You can only edit your own restaurants")).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();
  // submission is re-enabled so the user can try again
  expect(submitButton()).not.toBeDisabled();
});

test("a 400 whose errors are a WTForms dict is still shown", async () => {
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ errors: { name: ["Field must be between 1 and 100 characters long."] } }),
    })
  );

  renderModal();
  fireEvent.click(submitButton());

  expect(
    await screen.findByText("Field must be between 1 and 100 characters long.")
  ).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();
});

test("a dropped connection is reported instead of stranding the form", async () => {
  (global as any).fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));

  renderModal();
  fireEvent.click(submitButton());

  expect(
    await screen.findByText(/Couldn't reach the server/i)
  ).toBeInTheDocument();
  expect(mockCloseModal).not.toHaveBeenCalled();
  expect(submitButton()).not.toBeDisabled();
});

test("client-side validation blocks the request entirely", async () => {
  (global as any).fetch = jest.fn();

  renderModal();
  // A website with no dot fails the shared rules.
  fireEvent.change(screen.getByDisplayValue("http://testbistro.com"), {
    target: { value: "notaurl" },
  });
  fireEvent.click(submitButton());

  expect(
    await screen.findByText("Please enter a valid website URL (e.g., example.com)")
  ).toBeInTheDocument();
  expect((global as any).fetch).not.toHaveBeenCalled();
  expect(mockCloseModal).not.toHaveBeenCalled();
});

test("a non-owner is not offered the form at all", () => {
  renderModal(OWNER_ID + 1);
  expect(screen.getByText("You are not the owner")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
});

test("a signed-out visitor is asked to log in", () => {
  renderModal(null);
  expect(screen.getByText(/Please log in to update the restaurant/i)).toBeInTheDocument();
});
