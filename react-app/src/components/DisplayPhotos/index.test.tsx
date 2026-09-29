import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import photoReducer from "../../store/restaurantPhoto";
import restaurantsReducer from "../../store/restaurants";
import DisplayPhotos from "./index";

/**
 * "See all photos". A load that failed used to leave "Loading..." up for
 * good, or show whichever restaurant's photos were in the store last (#116).
 */

const restaurant: any = { id: 3, user_id: 1, name: "Uchi" };
const photo = (id: number, restaurantId: number) => ({
  id, restaurant_id: restaurantId, url: `https://img/${id}.jpg`, preview: false, createdByUserId: 1,
});
const ok = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

function renderPhotos(storedPhotos: any[] = []) {
  const store = createStore(
    combineReducers({ session: (state = { user: null }) => state, photos: photoReducer, Restaurants: restaurantsReducer }),
    { photos: { allRestaurantImages: Object.fromEntries(storedPhotos.map((p) => [p.id, p])) } } as any,
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <DisplayPhotos singleRestaurant={restaurant} />
    </Provider>
  );
}

const shownPhotos = () =>
  Array.from(document.querySelectorAll(".indi-photo")).map((img) => img.getAttribute("src"));

afterEach(() => {
  delete (global as any).fetch;
});

test("a load that can't reach the server says so, and Try again loads them", async () => {
  const answers = [() => Promise.reject(new TypeError("Failed to fetch")), () => Promise.resolve(ok([photo(1, 3)]))];
  (global as any).fetch = jest.fn(() => answers.shift()!());
  renderPhotos();

  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(shownPhotos()).toEqual(["https://img/1.jpg"]));
});

test("another restaurant's photos left in the store are not shown as this one's", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ errors: ["boom"] }) }));
  renderPhotos([photo(7, 1), photo(8, 1)]);

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(shownPhotos()).toEqual([]);
});

test("only this restaurant's photos are listed, even alongside another's", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(ok([photo(1, 3), photo(2, 3)])));
  renderPhotos([photo(7, 1)]);

  await waitFor(() => expect(shownPhotos()).toEqual(["https://img/1.jpg", "https://img/2.jpg"]));
});
