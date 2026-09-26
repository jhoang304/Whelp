import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import reviewReducer from "../../store/reviews";
import { ModalProvider, Modal } from "../../context/Modal";
import SingleRestaurant from "./index";

/**
 * The restaurant page's gallery, header and contact card: the parts it
 * decides for itself rather than hands to another component.
 */

const RESTAURANT = {
  id: 1, user_id: 9, name: "Nancy's Hustle", price: "$$$", address: "2704 Polk St", city: "Houston",
  state: "TX", zipcode: "77003", country: "USA", phone_number: "(832) 344-8051",
  website: "http://nancyshustle.com/", description: "A modern bistro.",
  User: { id: 9, firstName: "Demo", lastName: "User" },
  // The cover is third in the list; the carousel leads with it anyway.
  restaurantImages: [
    { id: 11, url: "https://img/a.jpg", preview: false },
    { id: 12, url: "https://img/b.jpg", preview: false },
    { id: 13, url: "https://img/cover.jpg", preview: true },
  ],
  numReviews: 4, avgStarRating: 3.75, categories: [], amenities: [{ id: 1, name: "Free Wi-Fi", slug: "wifi" }],
  hours: [], openStatus: null, timezone: null, isFavorited: false,
};

function renderPage(user: any = null) {
  (global as any).fetch = jest.fn((url: string) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(url.includes("/reviews")
      ? { items: [], page: 1, per_page: 10, total: 0 }
      : RESTAURANT),
  }));
  const store = createStore(
    combineReducers({ session: (state = { user }) => state, Restaurants: restaurantsReducer, reviews: reviewReducer }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={["/single/1"]}>
        <ModalProvider>
          <Route path="/single/:restaurantId"><SingleRestaurant /></Route>
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
}

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("the carousel leads with the cover, and a photo opens enlarged where it was clicked", async () => {
  renderPage();
  const tiles = await screen.findAllByRole("button", { name: /^Enlarge photo/ });

  expect(tiles.map((tile) => tile.querySelector("img")!.getAttribute("src")))
    .toEqual(["https://img/cover.jpg", "https://img/a.jpg", "https://img/b.jpg"]);

  fireEvent.click(tiles[2]);
  expect(screen.getByRole("dialog", { name: "Photo viewer" })).toBeInTheDocument();
  expect(screen.getByAltText("Nancy's Hustle, 2 of 3")).toHaveAttribute("src", "https://img/b.jpg");
});

test("the arrows step through the photos, and each goes at its end", async () => {
  renderPage();
  await screen.findAllByRole("button", { name: /^Enlarge photo/ });
  // jsdom lays nothing out, so give the track a size: 500px showing of 1500.
  const track = document.querySelector(".restaurant-carousel-track") as HTMLElement;
  Object.defineProperty(track, "clientWidth", { value: 500, configurable: true });
  Object.defineProperty(track, "scrollWidth", { value: 1500, configurable: true });
  const scrollBy = jest.fn();
  (track as any).scrollBy = scrollBy;
  const back = screen.getByRole("button", { name: "Previous photos" });
  const forward = screen.getByRole("button", { name: "Next photos" });

  track.scrollLeft = 0;
  fireEvent.scroll(track);
  expect(back).toBeDisabled();
  expect(forward).toBeEnabled();

  fireEvent.click(forward);
  expect(scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "smooth" });

  track.scrollLeft = 1000;
  fireEvent.scroll(track);
  expect(back).toBeEnabled();
  expect(forward).toBeDisabled();
});

test("the header gives the rating as a number and jumps to the reviews", async () => {
  renderPage();
  expect(await screen.findByRole("heading", { level: 1, name: "Nancy's Hustle" })).toBeInTheDocument();
  expect(screen.getByText("3.8")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "4 reviews" })).toHaveAttribute("href", "#reviews");
});

test("the contact card links out, calls, and gives directions", async () => {
  renderPage();
  const website = await screen.findByRole("link", { name: /Website/ });
  // Shown without the scheme or trailing slash, linked with them.
  expect(website).toHaveTextContent("nancyshustle.com");
  expect(website).not.toHaveTextContent("http");
  expect(website).toHaveAttribute("href", "http://nancyshustle.com/");
  expect(screen.getByRole("link", { name: /Phone/ })).toHaveAttribute("href", "tel:8323448051");
  expect(screen.getByRole("link", { name: /Get directions/ }).getAttribute("href"))
    .toContain("2704+Polk+St,+Houston,+TX,+77003,+USA");
});

test("the actions are only for someone logged in, and Edit and Delete only for the owner", async () => {
  const { unmount } = renderPage();
  await screen.findByRole("heading", { level: 1 });
  expect(screen.queryByRole("button", { name: /Add photo/ })).not.toBeInTheDocument();
  unmount();

  renderPage({ id: 5 });
  expect(await screen.findByRole("button", { name: /Add photo/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit restaurant" })).not.toBeInTheDocument();
});

test("the owner gets Edit and Delete as well", async () => {
  renderPage({ id: 9 });
  expect(await screen.findByRole("button", { name: "Edit restaurant" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete restaurant" })).toBeInTheDocument();
});
