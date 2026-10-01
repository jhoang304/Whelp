import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import reviewReducer from "../../store/reviews";
import { ModalProvider, Modal } from "../../context/Modal";
import SingleRestaurant from "./index";
import { axe } from "../../testUtils/axe";

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
  numReviews: 4, avgStarRating: 3.75,
  categories: [{ id: 1, name: "Cocktail Bars", slug: "cocktail-bars" }, { id: 2, name: "Wine Bars", slug: "wine-bars" }],
  amenities: [{ id: 1, name: "Free Wi-Fi", slug: "wifi" }],
  hours: [{ weekday: 1, opens: "17:00", closes: "22:00" }], openStatus: null, timezone: null, isFavorited: false,
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

test("the name, rating, cuisines and hours are written over the photos", async () => {
  renderPage();
  const heading = await screen.findByRole("heading", { level: 1, name: "Nancy's Hustle" });
  // Inside the carousel, over the photos, as it was before the redesign.
  expect(heading.closest(".restaurant-carousel")).not.toBeNull();
  expect(document.querySelector(".restaurant-rating-text")).toHaveTextContent("3.8 (4 reviews)");
  expect(screen.getByRole("link", { name: "4 reviews" })).toHaveAttribute("href", "#reviews");
  expect(screen.getByText("Claimed")).toBeInTheDocument();
  expect(screen.getByText("$$$")).toBeInTheDocument();
  // Each cuisine goes to the list filtered by it.
  expect(screen.getByRole("link", { name: "Wine Bars" })).toHaveAttribute("href", "/restaurants?category=wine-bars");
  expect(document.querySelector(".restaurant-categories")).toHaveTextContent("Cocktail Bars, Wine Bars");
  expect(screen.getByRole("link", { name: "See hours" })).toHaveAttribute("href", "#hours");
  expect(document.getElementById("hours")).not.toBeNull();
});

test("the contact card links out, calls, and gives directions", async () => {
  renderPage();
  const website = await screen.findByRole("link", { name: /Website/ });
  // Shown without the scheme or trailing slash, linked with them.
  expect(website).toHaveTextContent("nancyshustle.com");
  expect(website).not.toHaveTextContent("http");
  expect(website).toHaveAttribute("href", "http://nancyshustle.com/");
  expect(screen.getByRole("link", { name: /Phone/ })).toHaveAttribute("href", "tel:8323448051");
  const directions = new URL(screen.getByRole("link", { name: /Get directions/ }).getAttribute("href")!);
  expect(directions.origin + directions.pathname).toBe("https://www.google.com/maps/search/");
  expect(directions.searchParams.get("query")).toBe("2704 Polk St, Houston, TX, 77003, USA");
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

// --- deleting the restaurant (#116) --------------------------------------------------

const OWNER = { id: 9, username: "demo" };

function renderForDelete(deleteAnswer: () => Promise<any>) {
  const requests: string[] = [];
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    requests.push(`${options.method ?? "GET"} ${url}`);
    if (options.method === "DELETE") return deleteAnswer();
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(url.includes("/reviews") ? { items: [], page: 1, per_page: 10, total: 0 } : RESTAURANT),
    });
  });
  const store = createStore(
    combineReducers({ session: (state = { user: OWNER }) => state, Restaurants: restaurantsReducer, reviews: reviewReducer }),
    applyMiddleware(thunk)
  );
  let history: any;
  render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={["/single/1"]}>
        <ModalProvider>
          <Route path="/single/:restaurantId"><SingleRestaurant /></Route>
          <Route path="*" render={(props) => { history = props.history; return null; }} />
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
  return { requests, history: () => history };
}

async function confirmDelete() {
  fireEvent.click(await screen.findByRole("button", { name: "Delete restaurant" }));
  fireEvent.click(screen.getByRole("dialog").querySelector(".delete-button") as HTMLElement);
}

test("a refused delete keeps the owner on the page and says why", async () => {
  const { history } = renderForDelete(() => Promise.resolve({
    ok: false, status: 403, json: () => Promise.resolve({ errors: ["You can only delete your own restaurants"] }),
  }));

  await confirmDelete();

  expect(await screen.findByRole("alert")).toHaveTextContent("You can only delete your own restaurants");
  expect(screen.getByRole("dialog", { name: "Delete Restaurant" })).toBeInTheDocument();
  expect(history().location.pathname).toBe("/single/1");
});

test("a delete that can't reach the server says so, and stays", async () => {
  const { history } = renderForDelete(() => Promise.reject(new TypeError("Failed to fetch")));

  await confirmDelete();

  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  expect(history().location.pathname).toBe("/single/1");
});

test("a delete that works goes home, without fetching the listing on the way", async () => {
  const { requests, history } = renderForDelete(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve({ message: "Successfully deleted" }),
  }));

  await confirmDelete();

  await waitFor(() => expect(history().location.pathname).toBe("/"));
  expect(requests.filter((request) => request.startsWith("GET /api/restaurants/?"))).toEqual([]);
});

// --- what a screen reader and a keyboard get (#122) ---------------------------------

test("the page has nothing axe objects to, the owner's controls included", async () => {
  const { container } = renderPage({ id: 9 });
  await screen.findByRole("button", { name: "Edit restaurant" });
  expect(await axe(container)).toHaveNoViolations();
});

test("Add photo has a close button, which a touch screen reader can reach", async () => {
  const { container } = renderPage({ id: 9 });
  fireEvent.click(await screen.findByRole("button", { name: /Add photo/ }));
  const dialog = screen.getByRole("dialog", { name: "Add Photo" });
  expect(await axe(container)).toHaveNoViolations();

  fireEvent.click(within(dialog).getByRole("button", { name: "Close Add Photo" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("the all-photos grid has a close button too", async () => {
  renderPage({ id: 9 });
  fireEvent.click(await screen.findByRole("button", { name: "See all 3 photos" }));
  // Named by its heading once the photos have loaded.
  const dialog = await screen.findByRole("dialog", { name: "Photos for Nancy's Hustle" });

  fireEvent.click(within(dialog).getByRole("button", { name: "Close photos" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

// --- the tab's title (#130) ------------------------------------------------------------

test("the tab is named for the restaurant once it loads, and given back when the page goes", async () => {
  document.title = "Whelp";
  const { unmount } = renderPage();
  // While it loads, the site's name: not the last page's title.
  expect(document.title).toBe("Whelp");

  await screen.findByRole("heading", { level: 1, name: "Nancy's Hustle" });
  expect(document.title).toBe("Nancy's Hustle – Houston, TX · Whelp");

  unmount();
  expect(document.title).toBe("Whelp");
});
