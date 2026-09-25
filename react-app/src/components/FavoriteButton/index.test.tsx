import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import userProfileReducer from "../../store/userProfile";
import RestaurantListEntry from "../RestaurantListEntry";
import FavoriteButton from "./index";

/**
 * The heart: a toggle that waits for the API, says where things stand, and
 * -- sitting over a card that is a link -- never follows the link.
 */

const okJson = (body: any, status = 200) => ({ ok: true, status, json: () => Promise.resolve(body) });

const restaurant = {
  id: 7, user_id: 1, name: "Nancy's Hustle", price: "$$$", address: "2704 Polk St", city: "Houston",
  state: "TX", zipcode: "77003", country: "USA", phone_number: "8323448051", description: "",
  website: "http://nancyshustle.com", avgRating: 4.5, previewImage: null, isFavorited: false,
};

function makeStore(user: any = { id: 3 }) {
  return createStore(
    combineReducers({
      session: (state = { user }) => state,
      Restaurants: restaurantsReducer,
      user: userProfileReducer,
    }),
    { Restaurants: { allRestaurants: { 7: restaurant } } } as any,
    applyMiddleware(thunk)
  );
}

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("it is a toggle named for the restaurant, pressed when saved", () => {
  const store = makeStore();
  const { rerender } = render(
    <Provider store={store as any}>
      <FavoriteButton restaurantId={7} name="Nancy's Hustle" isFavorited={false} />
    </Provider>
  );
  const button = screen.getByRole("button", { name: "Save Nancy's Hustle" });
  expect(button).toHaveAttribute("aria-pressed", "false");

  rerender(
    <Provider store={store as any}>
      <FavoriteButton restaurantId={7} name="Nancy's Hustle" isFavorited />
    </Provider>
  );
  // The same name either way: the pressed state is what changes.
  expect(screen.getByRole("button", { name: "Save Nancy's Hustle" })).toHaveAttribute("aria-pressed", "true");
});

test("saving posts, and every copy of the restaurant in the store takes the flag", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ isFavorited: true }, 201)));
  const store = makeStore();
  render(
    <Provider store={store as any}>
      <FavoriteButton restaurantId={7} name="Nancy's Hustle" isFavorited={false} />
    </Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Save Nancy's Hustle" }));

  await waitFor(() => expect((store.getState() as any).Restaurants.allRestaurants[7].isFavorited).toBe(true));
  expect((global as any).fetch).toHaveBeenCalledWith("/api/restaurants/7/favorite", { method: "POST" });
});

test("unsaving a saved one sends DELETE", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ isFavorited: false })));
  render(
    <Provider store={makeStore() as any}>
      <FavoriteButton restaurantId={7} name="Nancy's Hustle" isFavorited />
    </Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Save Nancy's Hustle" }));

  await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith("/api/restaurants/7/favorite", { method: "DELETE" }));
});

test("a failure leaves the heart as it was and says why", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: false, status: 404, json: () => Promise.resolve({ errors: ["Restaurant couldn't be found"] }),
  }));
  const store = makeStore();
  render(
    <Provider store={store as any}>
      <FavoriteButton restaurantId={7} name="Nancy's Hustle" isFavorited={false} />
    </Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Save Nancy's Hustle" }));

  expect(await screen.findByText("Restaurant couldn't be found")).toBeInTheDocument();
  expect((store.getState() as any).Restaurants.allRestaurants[7].isFavorited).toBe(false);
});

test("on a card, the heart saves without following the card's link", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(okJson({ isFavorited: true }, 201)));
  render(
    <Provider store={makeStore() as any}>
      <MemoryRouter initialEntries={["/restaurants"]}>
        <Route path="/restaurants">
          <RestaurantListEntry restaurant={restaurant as any} className="restaurant-list-item" delay={0} />
        </Route>
        <Route path="/single/:id">Detail page</Route>
      </MemoryRouter>
    </Provider>
  );

  const heart = screen.getByRole("button", { name: "Save Nancy's Hustle" });
  // Beside the link, not inside it.
  expect(heart.closest("a")).toBeNull();
  fireEvent.click(heart);

  await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
  expect(screen.queryByText("Detail page")).not.toBeInTheDocument();
});

test("someone logged out gets no heart", () => {
  render(
    <Provider store={makeStore(null) as any}>
      <MemoryRouter>
        <RestaurantListEntry restaurant={restaurant as any} className="restaurant-list-item" delay={0} />
      </MemoryRouter>
    </Provider>
  );
  expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/single/7");
});
