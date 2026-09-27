import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import categoriesReducer from "../../store/categories";
import RestaurantList from "./index";
import RestaurantBySearch from "../SearchBar";

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
  renderAt("/search/bistro?sort=rating", "/search/:keyword", <RestaurantBySearch />);

  await waitFor(() => expect(shown()).toEqual(["Best", "Second", "Third"]));
});
