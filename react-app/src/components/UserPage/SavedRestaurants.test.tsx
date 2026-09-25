import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import userProfileReducer from "../../store/userProfile";
import SavedRestaurants from "./SavedRestaurants";

/** The Saved tab: your hearts, newest first, and gone the moment you unsave. */

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const card = (id: number, name: string) => ({
  id, name, user_id: 1, price: "$$", city: "Houston", state: "TX", avgRating: 4, numReviews: 2,
  previewImage: null, isFavorited: true,
});

function renderSaved() {
  const store = createStore(
    combineReducers({
      session: (state = { user: { id: 3 } }) => state,
      Restaurants: restaurantsReducer,
      user: userProfileReducer,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <SavedRestaurants userId={3} />
      </MemoryRouter>
    </Provider>
  );
}

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("it lists what the API returns, in its order", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({
    items: [card(2, "Second Saved"), card(1, "First Saved")], page: 1, per_page: 20, total: 2,
  })));
  renderSaved();

  const names = await screen.findAllByText(/Saved$/, { selector: ".profile-business-name" });
  expect(names.map((node) => node.textContent)).toEqual(["Second Saved", "First Saved"]);
  expect((global as any).fetch).toHaveBeenCalledWith("/api/users/3/favorites?page=1&per_page=20");
  expect(screen.getByText("Only you can see the restaurants you've saved.")).toBeInTheDocument();
});

test("unsaving one takes it off the list", async () => {
  (global as any).fetch = jest.fn((_url: string, options: any = {}) =>
    Promise.resolve(options.method === "DELETE"
      ? okJson({ isFavorited: false })
      : okJson({ items: [card(2, "Keep Me"), card(1, "Drop Me")], page: 1, per_page: 20, total: 2 })));
  renderSaved();

  fireEvent.click(await screen.findByRole("button", { name: "Save Drop Me" }));

  await waitFor(() => expect(screen.queryByText("Drop Me")).not.toBeInTheDocument());
  expect(screen.getByText("Keep Me")).toBeInTheDocument();
});

test("with nothing saved it says how to save something", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ items: [], page: 1, per_page: 20, total: 0 })));
  renderSaved();

  expect(await screen.findByText("You haven't saved any restaurants yet")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse restaurants" })).toHaveAttribute("href", "/restaurants");
});

test("a refusal is shown rather than an empty list", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: false, status: 403, json: () => Promise.resolve({ errors: ["You can only see your own saved restaurants"] }),
  }));
  renderSaved();

  expect(await screen.findByText("You can only see your own saved restaurants")).toBeInTheDocument();
  expect(screen.queryByText("You haven't saved any restaurants yet")).not.toBeInTheDocument();
});

test("focus moves to the next heart after an unsave, and to the heading after the last", async () => {
  (global as any).fetch = jest.fn((_url: string, options: any = {}) =>
    Promise.resolve(options.method === "DELETE"
      ? okJson({ isFavorited: false })
      : okJson({ items: [card(2, "Alpha"), card(1, "Beta")], page: 1, per_page: 20, total: 2 })));
  renderSaved();

  const alpha = await screen.findByRole("button", { name: "Save Alpha" });
  alpha.focus();
  fireEvent.click(alpha);
  await waitFor(() => expect(screen.getByRole("button", { name: "Save Beta" })).toHaveFocus());

  fireEvent.click(screen.getByRole("button", { name: "Save Beta" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "You haven't saved any restaurants yet" })).toHaveFocus());
});
