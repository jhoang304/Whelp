import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import session from "./store/session";
import restaurantsReducer from "./store/restaurants";
import photoReducer from "./store/restaurantPhoto";
import reviewReducer from "./store/reviews";
import userProfileReducer from "./store/userProfile";
import categoriesReducer from "./store/categories";
import { ModalProvider } from "./context/Modal";
import { configureAxe } from "jest-axe";
import App from "./App";

/**
 * The app waits to learn who is signed in before it draws a page. When that
 * request failed outright, it waited for good: the nav bar over an empty
 * page (#116). Unreachable now reads as signed out.
 */

afterEach(() => {
  delete (global as any).fetch;
});

test("a dropped connection at start-up still draws the page, signed out", async () => {
  (global as any).fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  const store = createStore(
    combineReducers({
      session,
      Restaurants: restaurantsReducer,
      photos: photoReducer,
      reviews: reviewReducer,
      user: userProfileReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );

  render(
    <Provider store={store as any}>
      <ModalProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>
      </ModalProvider>
    </Provider>
  );

  expect(await screen.findByRole("button", { name: "Log in as Demo User" })).toBeInTheDocument();
  expect(store.getState().session.user).toBeNull();
});

test("a garbled answer at start-up still draws the page", async () => {
  // A 200 whose body won't parse: authenticate itself rejects, and the app
  // must not wait on it for good either.
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.reject(new SyntaxError("Unexpected token <")),
  }));
  const store = createStore(
    combineReducers({
      session,
      Restaurants: restaurantsReducer,
      photos: photoReducer,
      reviews: reviewReducer,
      user: userProfileReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );

  render(
    <Provider store={store as any}>
      <ModalProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>
      </ModalProvider>
    </Provider>
  );

  expect(await screen.findByRole("button", { name: "Log in as Demo User" })).toBeInTheDocument();
});

// --- landmarks, and the page each lands in (#122) ------------------------------------

// Every rule this time, "region" included: all of a page is inside a landmark.
const axeWholePage = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function renderAppAt(path: string) {
  // Signed out, as the API says it: {"user": null}, with a 200 (#126). And
  // every list empty: the home page asks for four of them (#134).
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve({ user: null, items: [] }),
  }));
  const store = createStore(
    combineReducers({
      session,
      Restaurants: restaurantsReducer,
      photos: photoReducer,
      reviews: reviewReducer,
      user: userProfileReducer,
      categories: categoriesReducer,
    }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <ModalProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ModalProvider>
    </Provider>
  );
}

test("every page is the main landmark, between the nav and the footer", async () => {
  const { container } = renderAppAt("/login");
  const heading = await screen.findByRole("heading", { level: 1, name: "Log In to Whelp" });

  expect(screen.getByRole("main")).toContainElement(heading);
  expect(screen.getByRole("navigation")).not.toContainElement(heading);
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Joshua Hoang");
  expect(await axeWholePage(container)).toHaveNoViolations();
});

test("a page with a <main> of its own doesn't put one inside the app's", async () => {
  // /settings had the only <main> before; it would be a second one now.
  const { container } = renderAppAt("/settings");
  await screen.findByRole("heading", { level: 1 });
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(await axeWholePage(container)).toHaveNoViolations();
});

test("home goes h1, then h2s, and its buttons are links", async () => {
  // An empty site: the sections with nothing in them are left out (#134).
  const { container } = renderAppAt("/");
  await screen.findByRole("heading", { level: 1, name: "Welcome to Whelp" });
  await screen.findByRole("heading", { level: 2, name: "No restaurants yet" });

  const levels = Array.from(screen.getByRole("main").querySelectorAll("h1, h2, h3, h4, h5, h6"))
    .map((heading) => heading.tagName);
  expect(levels).toEqual(["H1", "H2", "H2"]);
  expect(screen.getByRole("link", { name: "Explore all restaurants" })).toHaveAttribute("href", "/restaurants");
  expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  // Two search regions, the nav's and the page's, told apart by name.
  expect(screen.getAllByRole("search")).toHaveLength(2);
  expect(await axeWholePage(container)).toHaveNoViolations();
});

// --- an address the app has no page for (#124) ---------------------------------------

test.each([
  "/this-page-does-not-exist",
  "/restaurant/1",
  "/user/1",
  "/single",
  "/users/get",
  "/restaurants/create-review",
  "/3/reviews/abc/update",
])("%s is a not-found page inside the app, not a blank one", async (path) => {
  renderAppAt(path);

  const heading = await screen.findByRole("heading", { level: 1, name: "We couldn't find that page." });
  expect(screen.getByRole("main")).toContainElement(heading);
  expect(screen.getByRole("navigation")).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse restaurants" })).toHaveAttribute("href", "/restaurants");
  expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
});

test("a page that exists is not the not-found page", async () => {
  renderAppAt("/login");
  await screen.findByRole("heading", { level: 1, name: "Log In to Whelp" });
  expect(screen.queryByText("We couldn't find that page.")).not.toBeInTheDocument();
});

test("its tab says so, until you leave it for a page that exists", async () => {
  document.title = "Whelp";
  const { container } = renderAppAt("/nowhere");
  await screen.findByRole("heading", { level: 1, name: "We couldn't find that page." });
  expect(document.title).toBe("Page not found · Whelp");
  expect(await axeWholePage(container)).toHaveNoViolations();

  fireEvent.click(screen.getByRole("link", { name: "Go to the home page" }));
  await screen.findByRole("heading", { level: 1, name: "Welcome to Whelp" });
  // Home's own title, since #130; it was the site's bare name before.
  expect(document.title).toBe("Whelp – restaurant reviews");
});

// --- every page names its tab, and a screen reader hears the new one (#130) -----------

test.each([
  ["/", "Whelp – restaurant reviews", "Welcome to Whelp"],
  ["/login", "Log in · Whelp", "Log In to Whelp"],
  ["/signup", "Sign up · Whelp", "Create Your Account"],
  ["/settings", "Account settings · Whelp", "Account settings"],
  ["/nowhere", "Page not found · Whelp", "We couldn't find that page."],
])("%s is titled %s", async (path, title, heading) => {
  document.title = "Whelp";
  renderAppAt(path);
  await screen.findByRole("heading", { level: 1, name: heading });
  expect(document.title).toBe(title);
});

test("a new page's title is read out; the first one, which the browser said, isn't", async () => {
  document.title = "Whelp";
  renderAppAt("/login");
  await screen.findByRole("heading", { level: 1, name: "Log In to Whelp" });
  const announcer = document.querySelector('[aria-live="polite"]') as HTMLElement;
  expect(screen.getByRole("main")).toContainElement(announcer);
  expect(announcer).toBeEmptyDOMElement();

  fireEvent.click(screen.getAllByRole("link", { name: "Sign Up" })[0]);
  await screen.findByRole("heading", { level: 1, name: "Create Your Account" });
  await waitFor(() => expect(announcer).toHaveTextContent("Sign up · Whelp"));
});
