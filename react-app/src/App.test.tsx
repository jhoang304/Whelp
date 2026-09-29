import { render, screen } from "@testing-library/react";
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
