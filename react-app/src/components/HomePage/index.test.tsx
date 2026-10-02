import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import HomePage from "./index";
import { axe } from "../../testUtils/axe";

/**
 * The home page shows what is on the site (#134): a search, the cuisines
 * restaurants are listed under, the top rated and the newest, and the
 * latest reviews -- each loading, failing and trying again on its own, and
 * a sensible page when the site is empty.
 */

const ok = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const broken = () => ({ ok: false, status: 500, json: () => Promise.resolve({ errors: ["boom"] }) });

const restaurant = (id: number, name: string, overrides: any = {}) => ({
  id, user_id: 1, name, price: "$$", address: "1 Main St", city: "Houston", state: "TX", zipcode: "77002",
  country: "USA", phone_number: "", description: "", website: "", avgRating: 4.5, numReviews: 12,
  previewImage: `https://img/${id}.jpg`, categories: [{ id: 1, name: "Japanese", slug: "japanese" }],
  ...overrides,
});

const DATA: Record<string, any> = {
  "/api/categories/popular?limit=12": {
    items: [
      { id: 1, name: "Japanese", slug: "japanese", restaurantCount: 3 },
      { id: 2, name: "Wine Bars", slug: "wine-bars", restaurantCount: 1 },
    ],
  },
  "/api/restaurants/?sort=rating&min_rating=1&per_page=6": {
    items: [restaurant(1, "Uchi"), restaurant(2, "Nancy's Hustle", { avgRating: 4, numReviews: 1 })],
  },
  "/api/restaurants/?sort=newest&per_page=6": {
    items: [restaurant(9, "Brand New Place", { numReviews: 0, avgRating: 0, categories: [] })],
  },
  "/api/reviews/recent?limit=6": {
    items: [
      {
        id: 31, user_id: 4, restaurant_id: 1, review: "The omakase was worth every minute of the wait.", rating: 5,
        createdAt: "2026-09-30T12:00:00", updatedAt: "", reviewImages: [], response: null,
        user: { id: 4, username: "marnie", first_name: "Marnie", last_name: "J", profile_image_url: null },
        restaurant: { id: 1, name: "Uchi", city: "Houston", state: "TX" },
      },
      {
        id: 30, user_id: null, restaurant_id: 2, review: "Loud, but good.", rating: 3,
        createdAt: "2026-09-29T12:00:00", updatedAt: "", reviewImages: [], response: null,
        user: null, restaurant: { id: 2, name: "Nancy's Hustle", city: "Houston", state: "TX" },
      },
    ],
  },
};

/** Each list from DATA, unless `answers` says otherwise for its url. */
function serve(answers: Record<string, () => any> = {}) {
  (global as any).fetch = jest.fn((url: string) => {
    if (answers[url]) return Promise.resolve(answers[url]());
    if (DATA[url]) return Promise.resolve(ok(DATA[url]));
    return Promise.resolve(broken());
  });
}

let where: any;

function renderHome(user: any = null) {
  const store = createStore(
    combineReducers({ session: (state = { user }) => state, Restaurants: restaurantsReducer }),
    applyMiddleware(thunk)
  );
  const view = render(
    <Provider store={store as any}>
      <MemoryRouter>
        <HomePage />
        <Route path="*" render={({ location }) => { where = location; return null; }} />
      </MemoryRouter>
    </Provider>
  );
  return { ...view, store };
}

const section = (name: string) => screen.getByRole("region", { name });

/** Every section has its answer: none is still loading. */
const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());

afterEach(() => {
  delete (global as any).fetch;
});

// --- what it shows ------------------------------------------------------------------

test("cuisines, each a link to its restaurants, most used first, with how many", async () => {
  serve();
  renderHome();
  await settled();

  const cuisines = section("Browse by cuisine");
  const links = within(cuisines).getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual(["Japanese3 restaurants", "Wine Bars1 restaurant"]);
  expect(links[0]).toHaveAttribute("href", "/restaurants?category=japanese");
});

test("top rated and new restaurants, each a tile linking to its page, and See all with the sort", async () => {
  serve();
  renderHome();
  await settled();

  const top = section("Top rated");
  expect(within(top).getByRole("link", { name: "Uchi" })).toHaveAttribute("href", "/single/1");
  expect(within(top).getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
  expect(within(top).getByText("12 reviews")).toBeInTheDocument();
  expect(within(top).getByText("1 review")).toBeInTheDocument();
  expect(within(top).getByRole("link", { name: "See all top rated restaurants" })).toHaveAttribute("href", "/restaurants?sort=rating");

  const fresh = section("New on Whelp");
  expect(within(fresh).getByRole("link", { name: "Brand New Place" })).toHaveAttribute("href", "/single/9");
  // Not "0 out of 5 stars": nobody has said yet.
  expect(within(fresh).getByText("No reviews yet")).toBeInTheDocument();
  expect(within(fresh).queryByRole("img", { name: /out of 5 stars/ })).not.toBeInTheDocument();
  expect(within(fresh).getByRole("link", { name: "See all new restaurants" })).toHaveAttribute("href", "/restaurants?sort=newest");
});

test("recent reviews say who, where and what, and a departed author is a deleted user", async () => {
  serve();
  renderHome();
  await settled();

  const reviews = section("Recent reviews");
  const [first, second] = within(reviews).getAllByRole("listitem");
  expect(within(first).getByRole("link", { name: "marnie" })).toHaveAttribute("href", "/users/get/4");
  expect(within(first).getByRole("link", { name: "Uchi" })).toHaveAttribute("href", "/single/1");
  expect(within(first).getByText("The omakase was worth every minute of the wait.")).toBeInTheDocument();
  expect(within(first).getByText("September 30, 2026")).toBeInTheDocument();
  expect(within(second).getByText("Deleted user")).toBeInTheDocument();
  expect(within(second).queryByRole("link", { name: "Deleted user" })).not.toBeInTheDocument();
});

test("top rated asks only for restaurants someone has reviewed", async () => {
  serve();
  renderHome();
  await settled();

  const urls = ((global as any).fetch as jest.Mock).mock.calls.map(([url]) => url);
  expect(urls).toEqual(expect.arrayContaining(["/api/restaurants/?sort=rating&min_rating=1&per_page=6"]));
});

test("it leaves the listing's restaurants alone", async () => {
  serve();
  const { store } = renderHome();
  await settled();

  expect(store.getState().Restaurants.allRestaurants ?? {}).toEqual({});
});

// --- the search ---------------------------------------------------------------------

test("the search goes to the results for what is typed, and to every restaurant for nothing", async () => {
  serve();
  renderHome();
  await settled();
  const search = screen.getByRole("search", { name: "Find a restaurant" });
  const box = within(search).getByRole("searchbox", { name: "Search restaurants" });

  fireEvent.change(box, { target: { value: "  bar & grill " } });
  fireEvent.click(within(search).getByRole("button", { name: "Search" }));
  expect(where.pathname).toBe("/search");
  expect(new URLSearchParams(where.search).get("q")).toBe("bar & grill");

  fireEvent.change(box, { target: { value: "   " } });
  fireEvent.submit(search);
  expect(where.pathname).toBe("/restaurants");
});

// --- loading, failing, nothing --------------------------------------------------------

test("while a section loads it shows stand-ins, and says it is loading", async () => {
  let answer: (value: any) => void = () => {};
  serve({ "/api/reviews/recent?limit=6": () => new Promise((resolve) => { answer = resolve; }) });
  renderHome();

  const reviews = section("Recent reviews");
  expect(reviews).toHaveAttribute("aria-busy", "true");
  expect(within(reviews).getByText("Loading recent reviews...")).toBeInTheDocument();
  expect(reviews.querySelectorAll(".home-skeleton")).toHaveLength(3);

  answer(ok(DATA["/api/reviews/recent?limit=6"]));
  await settled();
  expect(section("Recent reviews").querySelectorAll(".home-skeleton")).toHaveLength(0);
});

test("a section that can't load says so, and tries again on its own", async () => {
  const answers = [broken, () => ok(DATA["/api/restaurants/?sort=rating&min_rating=1&per_page=6"])];
  serve({ "/api/restaurants/?sort=rating&min_rating=1&per_page=6": () => answers.shift()!() });
  renderHome();

  const top = await screen.findByText("Couldn't load the top rated restaurants.");
  // The others are fine.
  expect(await screen.findByRole("link", { name: "Brand New Place" })).toBeInTheDocument();
  expect(within(section("Top rated")).queryByRole("link", { name: /See all/ })).not.toBeInTheDocument();

  fireEvent.click(within(top.parentElement as HTMLElement).getByRole("button", { name: "Try again" }));
  expect(await within(section("Top rated")).findByRole("link", { name: "Uchi" })).toBeInTheDocument();
  await settled();
});

test("a dropped connection says so in the section", async () => {
  (global as any).fetch = jest.fn((url: string) => url.startsWith("/api/categories")
    ? Promise.reject(new TypeError("Failed to fetch"))
    : Promise.resolve(ok(DATA[url])));
  renderHome();

  expect(await within(section("Browse by cuisine")).findByText(/Couldn't reach the server/)).toBeInTheDocument();
  await settled();
});

test("an empty site is still a page: no empty sections, and a word about why", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(ok({ items: [] })));
  renderHome();

  expect(await screen.findByRole("heading", { name: "No restaurants yet" })).toBeInTheDocument();
  await settled();
  expect(screen.queryByRole("region", { name: "Recent reviews" })).not.toBeInTheDocument();
  for (const name of ["Browse by cuisine", "Top rated", "New on Whelp"]) {
    expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
  }
  expect(screen.getByRole("search", { name: "Find a restaurant" })).toBeInTheDocument();
});

// --- signed in or not -------------------------------------------------------------------

test("signed out, the last panel asks you to join", async () => {
  serve();
  renderHome();

  const panel = screen.getByRole("region", { name: "Ready to find your next favorite restaurant?" });
  expect(within(panel).getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  expect(within(panel).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  await settled();
});

test("signed in, it welcomes you back and offers what you can do instead", async () => {
  serve();
  renderHome({ id: 7, username: "demo", first_name: "Demo" });

  const panel = screen.getByRole("region", { name: "Welcome back, Demo" });
  expect(within(panel).getByRole("link", { name: "Find a place to review" })).toHaveAttribute("href", "/restaurants");
  expect(within(panel).getByRole("link", { name: "Your reviews and saved places" })).toHaveAttribute("href", "/users/get/7");
  expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
  await settled();
});

// --- structure ------------------------------------------------------------------------

test("an h1, a h2 for each section, an h3 for each restaurant, and nothing an accessibility check fails", async () => {
  serve();
  const { container } = renderHome();
  await settled();

  const levels = Array.from(container.querySelectorAll("h1, h2, h3")).map((heading) => `${heading.tagName} ${heading.textContent}`);
  expect(levels).toEqual([
    "H1 Welcome to Whelp",
    "H2 Browse by cuisine",
    "H2 Top rated", "H3 Uchi", "H3 Nancy's Hustle",
    "H2 New on Whelp", "H3 Brand New Place",
    "H2 Recent reviews",
    "H2 Ready to find your next favorite restaurant?",
  ]);
  expect(await axe(container)).toHaveNoViolations();
});
