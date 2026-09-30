import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import categoriesReducer from "../../store/categories";
import RestaurantList from "./index";
import RestaurantBySearch from "../SearchBar";
import { deferredFetch, ok as okHeld, query, refused } from "../../testUtils/deferredFetch";
import { axe } from "../../testUtils/axe";

/**
 * Sort by, and search's relevance, reach the page: the cards come out in the
 * order the API sent them, not by id (#106).
 */

const card = (id: number, name: string) => ({
  id, user_id: 1, name, price: "$", address: "", city: "Houston", state: "TX", zipcode: "77003",
  country: "USA", phone_number: "", description: "", website: "", avgRating: 4, numReviews: 1,
  previewImage: null, oneReview: null, categories: [], amenities: [], openStatus: null, isFavorited: false,
});
const ok = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

// Highest rated first, as `?sort=rating` answers: ids deliberately out of order.
const PAGE_ONE = [card(9, "Best"), card(2, "Second"), card(5, "Third")];
const PAGE_TWO = [card(7, "Fourth"), card(1, "Fifth")];

function renderAt(path: string, routePath: string, element: React.ReactNode) {
  (global as any).fetch = jest.fn((url: string) => {
    if (url.startsWith("/api/categories") || url.startsWith("/api/restaurants/cities")) {
      return Promise.resolve(ok({ items: [] }));
    }
    const second = /[?&]page=2(&|$)/.test(url);
    return Promise.resolve(ok({ items: second ? PAGE_TWO : PAGE_ONE, page: second ? 2 : 1, per_page: 20, total: 5 }));
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
        <Route path={routePath}>{element}</Route>
      </MemoryRouter>
    </Provider>
  );
}

const shown = () => Array.from(document.querySelectorAll(".bold-name")).map((name) => name.textContent);

afterEach(() => {
  delete (global as any).fetch;
});

test("the listing shows restaurants in the order the API sorted them", async () => {
  renderAt("/restaurants?sort=rating", "/restaurants", <RestaurantList />);

  await waitFor(() => expect(shown()).toEqual(["Best", "Second", "Third"]));
});

test("Show more puts the next page after the first, not among it", async () => {
  renderAt("/restaurants?sort=rating", "/restaurants", <RestaurantList />);
  fireEvent.click(await screen.findByRole("button", { name: "Show more (3 of 5)" }));

  await waitFor(() => expect(shown()).toEqual(["Best", "Second", "Third", "Fourth", "Fifth"]));
});

test("search results keep the API's order too", async () => {
  renderAt("/search?q=bistro&sort=rating", "/search", <RestaurantBySearch />);

  await waitFor(() => expect(shown()).toEqual(["Best", "Second", "Third"]));
});

// --- answers that arrive after the reader has moved on (#115) ------------------------

/**
 * The listing or search page at `path`, with every list request held until
 * the test answers it. Returns the router's history, to change the URL the
 * way the filter bar and the search box do.
 */
function renderHeld(path: string, routePath: string, element: React.ReactNode) {
  const server = deferredFetch((url) =>
    url.startsWith("/api/categories") || url.startsWith("/api/restaurants/cities") ? okHeld({ items: [] }) : undefined);
  const store = createStore(
    combineReducers({
      session: (state = { user: null }) => state,
      Restaurants: restaurantsReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );
  let history: any;
  render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[path]}>
        <Route path={routePath}>{element}</Route>
        <Route path="*" render={(props) => { history = props.history; return null; }} />
      </MemoryRouter>
    </Provider>
  );
  return { server, history: () => history };
}

const listPage = (cards: any[], total = cards.length, page = 1) => okHeld({ items: cards, page, per_page: 20, total });
const prices = (url: string) => query(url).getAll("price").join(",");
const isPage = (n: number) => (url: string) => (query(url).get("page") ?? "1") === String(n);
const loading = () => document.querySelector(".loading-container, .search-loading");

test("a filter changed before the last one answered shows the new filter's restaurants", async () => {
  const { server, history } = renderHeld("/restaurants?price=$", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  act(() => { history().push("/restaurants?price=$$"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));

  await act(async () => server.answer((url) => prices(url) === "$$", listPage([card(2, "Pricier")])));
  await act(async () => server.answer((url) => prices(url) === "$", listPage([card(1, "Cheap")])));

  expect(shown()).toEqual(["Pricier"]);
});

test("the old filter answering first doesn't end the new one's loading", async () => {
  const { server, history } = renderHeld("/restaurants?price=$", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  act(() => { history().push("/restaurants?price=$$"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));

  await act(async () => server.answer((url) => prices(url) === "$", listPage([card(1, "Cheap")])));
  expect(loading()).not.toBeNull();
  expect(shown()).toEqual([]);

  await act(async () => server.answer((url) => prices(url) === "$$", listPage([card(2, "Pricier")])));
  expect(loading()).toBeNull();
  expect(shown()).toEqual(["Pricier"]);
});

test("a Show more still on its way when the filter changes is not added to the new list", async () => {
  const { server, history } = renderHeld("/restaurants", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  await act(async () => server.answer(isPage(1), listPage([card(1, "Any 1")], 2)));
  fireEvent.click(screen.getByRole("button", { name: "Show more (1 of 2)" }));
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  act(() => { history().push("/restaurants?price=$$$"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  await act(async () => server.answer((url) => prices(url) === "$$$", listPage([card(3, "Posh 1"), card(4, "Posh 2")], 3)));
  await act(async () => server.answer(isPage(2), listPage([card(5, "Any 2")], 2, 2)));

  expect(shown()).toEqual(["Posh 1", "Posh 2"]);
  // Its own Show more, ready to press: the old one's loading ended with it.
  expect(screen.getByRole("button", { name: "Show more (2 of 3)" })).not.toBeDisabled();
});

test("a search changed before the last one answered shows the new search's results", async () => {
  const { server, history } = renderHeld("/search?q=pizza", "/search", <RestaurantBySearch />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  act(() => { history().push("/search?q=sushi"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));

  await act(async () => server.answer((url) => query(url).get("q") === "pizza", listPage([card(1, "Pizza Place")])));
  expect(loading()).not.toBeNull();

  await act(async () => server.answer((url) => query(url).get("q") === "sushi", listPage([card(2, "Sushi Spot")])));
  expect(shown()).toEqual(["Sushi Spot"]);
  expect(loading()).toBeNull();
});

test("a search's Show more still on its way when the keyword changes is not added", async () => {
  const { server, history } = renderHeld("/search?q=pizza", "/search", <RestaurantBySearch />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  await act(async () => server.answer(isPage(1), listPage([card(1, "Pizza 1")], 2)));
  fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  act(() => { history().push("/search?q=sushi"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  await act(async () => server.answer((url) => query(url).get("q") === "sushi", listPage([card(2, "Sushi 1")])));
  await act(async () => server.answer(isPage(2), listPage([card(3, "Pizza 2")], 2, 2)));

  expect(shown()).toEqual(["Sushi 1"]);
});

test("the old list's Show more finishing doesn't end the new list's own", async () => {
  const { server, history } = renderHeld("/restaurants", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  await act(async () => server.answer(isPage(1), listPage([card(1, "Any 1")], 2)));
  fireEvent.click(screen.getByRole("button", { name: "Show more (1 of 2)" }));

  act(() => { history().push("/restaurants?price=$$$"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  await act(async () => server.answer((url) => prices(url) === "$$$", listPage([card(3, "Posh 1")], 3)));
  fireEvent.click(screen.getByRole("button", { name: "Show more (1 of 3)" }));
  await waitFor(() => expect(server.waiting()).toHaveLength(2));

  // The old page 2 answers while the new page 2 is still on its way.
  await act(async () => server.answer((url) => isPage(2)(url) && prices(url) === "", listPage([card(5, "Any 2")], 2, 2)));
  expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
});

// --- a list that couldn't be loaded (#116) -------------------------------------------

test("a dropped connection says the list couldn't load, and Try again loads it", async () => {
  const { server } = renderHeld("/restaurants", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  await act(async () => server.drop(isPage(1)));

  expect(loading()).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load restaurants");
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the server");

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  await act(async () => server.answer(isPage(1), listPage([card(1, "Back Again")])));
  expect(shown()).toEqual(["Back Again"]);
});

test("a server error is the list not loading, not a filter it refused", async () => {
  const { server } = renderHeld("/restaurants?price=$$", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  await act(async () => server.answer(isPage(1), refused(500, ["An unexpected error occurred."])));

  expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load restaurants");
  expect(screen.queryByText("We could not use those filters")).not.toBeInTheDocument();
});

test("a filter the API refuses is still said to be the filter's fault", async () => {
  const { server } = renderHeld("/restaurants?rating=9", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  await act(async () => server.answer(isPage(1), refused(400, ["rating must be between 1 and 5"])));

  expect(screen.getByText("We could not use those filters")).toBeInTheDocument();
  expect(screen.getByText("rating must be between 1 and 5")).toBeInTheDocument();
});

test("a Show more that fails says so, and can be pressed again", async () => {
  const { server } = renderHeld("/restaurants", "/restaurants", <RestaurantList />);
  await waitFor(() => expect(server.waiting()).toHaveLength(1));
  await act(async () => server.answer(isPage(1), listPage([card(1, "Any 1")], 2)));
  fireEvent.click(screen.getByRole("button", { name: "Show more (1 of 2)" }));
  await waitFor(() => expect(server.waiting()).toHaveLength(1));

  await act(async () => server.drop(isPage(2)));

  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the server");
  expect(screen.getByRole("button", { name: "Show more (1 of 2)" })).not.toBeDisabled();
  expect(shown()).toEqual(["Any 1"]);
});

// --- what a screen reader and a keyboard get (#122) ---------------------------------

const WINE = { id: 4, name: "Wine Bars", slug: "wine-bars" };
const BISTRO = { id: 6, name: "Bistros", slug: "bistros" };

function renderCards(path: string, routePath: string, element: React.ReactNode) {
  const cards = [
    { ...card(9, "Best"), categories: [WINE, BISTRO], oneReview: "Lovely." },
    { ...card(2, "Second"), categories: [BISTRO] },
  ];
  (global as any).fetch = jest.fn((url: string) => {
    if (url.startsWith("/api/categories")) return Promise.resolve(ok({ items: [WINE, BISTRO] }));
    if (url.startsWith("/api/restaurants/cities")) return Promise.resolve(ok({ items: ["Houston"] }));
    return Promise.resolve(ok({ items: cards, page: 1, per_page: 20, total: 2 }));
  });
  const store = createStore(
    combineReducers({
      session: (state = { user: null }) => state,
      Restaurants: restaurantsReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[path]}>
        <Route path={routePath}>{element}</Route>
      </MemoryRouter>
    </Provider>
  );
}

test("each card is one link, named for its restaurant, with its cuisines as links beside it", async () => {
  const { container } = renderCards("/restaurants", "/restaurants", <RestaurantList />);

  const best = await screen.findByRole("link", { name: "Best" });
  expect(best).toHaveAttribute("href", "/single/9");
  // The name, not the whole card read out: price, cuisines, the review...
  expect(screen.getByRole("heading", { level: 2, name: "Best" })).toContainElement(best);
  // Cuisines are links of their own, and nothing is inside another link.
  expect(screen.getAllByRole("link", { name: "Bistros" }).map((link) => link.getAttribute("href")))
    .toEqual(["/restaurants?category=bistros", "/restaurants?category=bistros"]);
  expect(container.querySelectorAll("a a, a button, button a")).toHaveLength(0);
  expect(await axe(container)).toHaveNoViolations();
});

test("the list has a heading, which names the cuisine it is filtered to", async () => {
  renderCards("/restaurants", "/restaurants", <RestaurantList />);
  expect(await screen.findByRole("heading", { level: 1, name: "All restaurants" })).toBeInTheDocument();
  await screen.findByRole("link", { name: "Best" });
});

test("filtered to a cuisine, the heading says which", async () => {
  renderCards("/restaurants?category=wine-bars", "/restaurants", <RestaurantList />);
  expect(await screen.findByRole("heading", { level: 1, name: "Wine Bars" })).toBeInTheDocument();
});

test("search results are headed by what was found", async () => {
  const { container } = renderCards("/search?q=bistro", "/search", <RestaurantBySearch />);
  expect(await screen.findByRole("heading", { level: 1, name: '2 search results for "bistro"' })).toBeInTheDocument();
  await screen.findByRole("link", { name: "Best" });
  expect(await axe(container)).toHaveNoViolations();
});
