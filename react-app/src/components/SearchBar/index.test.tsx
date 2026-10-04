import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route, Switch } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import categoriesReducer from "../../store/categories";
import RestaurantBySearch, { LegacySearchRedirect } from "./index";

/**
 * The keyword lives in `?q=` and is decoded exactly once (#108). In the path
 * the router had already decoded it once, and decoding it again threw on a
 * lone "%" -- during render, which blanked the whole app -- while Show more
 * and the filters sent the half-decoded "bar %26 grill" on to the API.
 */

const card = (id: number) => ({
  id, user_id: 1, name: `Place ${id}`, price: "$", address: "", city: "Houston", state: "TX",
  zipcode: "77003", country: "USA", phone_number: "", description: "", website: "", avgRating: 4,
  numReviews: 1, previewImage: null, oneReview: null, categories: [], amenities: [], openStatus: null,
  isFavorited: false,
});
const ok = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

/** Each search request the page made, as { q, page, price } read back out of its URL. */
let searches: { q: string | null; page: string | null; price: string[] }[] = [];

function renderAt(path: string, total = 3) {
  searches = [];
  (global as any).fetch = vi.fn((url: string) => {
    if (url.startsWith("/api/categories") || url.startsWith("/api/restaurants/cities")) {
      return Promise.resolve(ok({ items: [] }));
    }
    const params = new URL(url, "http://whelp.test").searchParams;
    searches.push({ q: params.get("q"), page: params.get("page"), price: params.getAll("price") });
    const page = Number(params.get("page"));
    const items = page === 1 ? [card(1), card(2)] : [card(3)];
    return Promise.resolve(ok({ items, page, per_page: 20, total }));
  });
  const store = createStore(
    combineReducers({
      session: (state = { user: null }) => state,
      Restaurants: restaurantsReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );
  render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[path]}>
        <Switch>
          <Route exact path="/search"><RestaurantBySearch /></Route>
          <Route path="/search/:keyword"><LegacySearchRedirect /></Route>
          <Route path="/restaurants">Every restaurant</Route>
        </Switch>
      </MemoryRouter>
    </Provider>
  );
}

afterEach(() => {
  delete (global as any).fetch;
});

test("a keyword with a % in it is searched for, not a crash", async () => {
  renderAt("/search?q=100%25%20beef");

  expect(await screen.findByText(/3 search results for "100% beef"/)).toBeInTheDocument();
  expect(searches[0]).toMatchObject({ q: "100% beef", page: "1" });
});

test("Show more asks for the same keyword as the first page", async () => {
  renderAt("/search?q=bar%20%26%20grill");
  fireEvent.click(await screen.findByRole("button", { name: "Show more (2 of 3)" }));

  await waitFor(() => expect(searches).toHaveLength(2));
  expect(searches.map(({ q, page }) => [q, page])).toEqual([["bar & grill", "1"], ["bar & grill", "2"]]);
});

test("a filter keeps the keyword, and the keyword keeps its / and +", async () => {
  renderAt("/search?q=24%2F7%20c%2B%2B");
  await screen.findByText(/search results for "24\/7 c\+\+"/);

  fireEvent.click(screen.getByRole("button", { name: "$" }));

  await waitFor(() => expect(searches).toHaveLength(2));
  expect(searches[1]).toMatchObject({ q: "24/7 c++", page: "1", price: ["$"] });
  expect(screen.getByRole("button", { name: "$" })).toHaveAttribute("aria-pressed", "true");
});

test.each([
  ["/search/100%25%20beef", "100% beef"],
  ["/search/bar%20%26%20grill", "bar & grill"],
  ["/search/24%2F7", "24/7"],
])("an old link, %s, still opens the search for %s", async (path, keyword) => {
  renderAt(path);

  expect(await screen.findByText(new RegExp(`search results for "${keyword.replace(/[+/]/g, "\\$&")}"`))).toBeInTheDocument();
  expect(searches[0].q).toBe(keyword);
});

test("an old link keeps its filters", async () => {
  renderAt("/search/pizza?price=%24%24");

  await screen.findByText(/search results for "pizza"/);
  expect(searches[0]).toMatchObject({ q: "pizza", price: ["$$"] });
});

test("no keyword at all goes to the listing", async () => {
  renderAt("/search?q=%20%20");

  expect(await screen.findByText("Every restaurant")).toBeInTheDocument();
  expect(searches).toHaveLength(0);
});
