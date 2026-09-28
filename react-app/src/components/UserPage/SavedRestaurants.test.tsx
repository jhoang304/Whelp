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
  expect((global as any).fetch).toHaveBeenCalledWith("/api/users/3/favorites?offset=0&per_page=20");
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

// --- more than one page (#113) ---------------------------------------------------

/**
 * `count` saved restaurants, newest first, paged the way the API pages them:
 * `offset` and `per_page` off the query string. Unsaving one takes it off.
 */
function serveSaved(count: number) {
  let list = Array.from({ length: count }, (_, index) => card(count - index, `Saved ${count - index}`));
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    if (options.method === "DELETE") {
      const id = Number(url.split("/")[3]);
      list = list.filter((item) => item.id !== id);
      return Promise.resolve(okJson({ isFavorited: false }));
    }
    const query = new URLSearchParams(url.split("?")[1]);
    const offset = Number(query.get("offset"));
    const perPage = Number(query.get("per_page"));
    return Promise.resolve(okJson({
      items: list.slice(offset, offset + perPage), page: 1, per_page: perPage, offset, total: list.length,
    }));
  });
  return { names: () => list.map((item) => item.name), add: (id: number) => list.unshift(card(id, `Saved ${id}`)) };
}

const shownNames = () =>
  Array.from(document.querySelectorAll(".profile-business-name")).map((node) => node.textContent);

test("unsaving two, then Show more, loses none, and the button goes at the end", async () => {
  const server = serveSaved(25);
  renderSaved();

  fireEvent.click(await screen.findByRole("button", { name: "Save Saved 24" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Saved 23" }));
  await waitFor(() => expect(shownNames()).toHaveLength(18));

  fireEvent.click(screen.getByRole("button", { name: "Show more (18 of 23)" }));

  await waitFor(() => expect(shownNames()).toHaveLength(23));
  // Saved 5 and Saved 4 used to be the two page 2 started past.
  expect(shownNames()).toEqual(server.names());
  expect(screen.queryByRole("button", { name: /Show more|Loading/ })).not.toBeInTheDocument();
});

test("a save made elsewhere meanwhile shows no card twice, and the button still ends", async () => {
  const server = serveSaved(25);
  renderSaved();
  await waitFor(() => expect(shownNames()).toHaveLength(20));

  server.add(99); // saved on another page: the newest, so it goes on top
  fireEvent.click(screen.getByRole("button", { name: "Show more (20 of 25)" }));
  await waitFor(() => expect(shownNames()).toHaveLength(25));
  expect(new Set(shownNames()).size).toBe(25);

  // The total counts Saved 99, which sits above this list: the next click
  // brings nothing new, and that is the end.
  fireEvent.click(screen.getByRole("button", { name: "Show more (25 of 26)" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /Show more|Loading/ })).not.toBeInTheDocument());
  expect(shownNames()).toHaveLength(25);
});
