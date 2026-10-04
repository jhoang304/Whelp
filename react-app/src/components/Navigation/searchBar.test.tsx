import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import restaurantsReducer from "../../store/restaurants";
import Navigation from "./index";
import { readKeyword } from "../../utils/filters";

/**
 * The bar has no Restaurants link: the search button is the way to every
 * restaurant. With nothing typed it browses them all; with a word, it goes
 * to that word's results -- and leaves the searching to the results page.
 */

function renderBar() {
  const store = createStore(
    combineReducers({ session: (state = { user: null }) => state, Restaurants: restaurantsReducer }),
    applyMiddleware(thunk)
  );
  render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={["/single/7"]}>
        <Navigation />
        <Route path="/restaurants">Every restaurant</Route>
        <Route path="/search" render={({ location }) => `Results for ${readKeyword(location.search)}`} />
      </MemoryRouter>
    </Provider>
  );
}

const input = () => screen.getByRole("textbox", { name: "Search restaurants" });

afterEach(() => {
  delete (global as any).fetch;
});

test("there is no Restaurants link in the bar", () => {
  renderBar();
  expect(screen.queryByRole("link", { name: /Restaurants/ })).not.toBeInTheDocument();
});

test("with nothing typed, the search button browses every restaurant", () => {
  (global as any).fetch = vi.fn();
  renderBar();
  const button = screen.getByRole("button", { name: "Browse all restaurants" });
  expect(button).toBeEnabled();

  fireEvent.click(button);

  expect(screen.getByText("Every restaurant")).toBeInTheDocument();
  // Browsing, not an empty search.
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test("only spaces count as nothing typed", () => {
  renderBar();
  fireEvent.change(input(), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Browse all restaurants" }));
  expect(screen.getByText("Every restaurant")).toBeInTheDocument();
});

test("with a word typed, the same button goes to its results", async () => {
  (global as any).fetch = vi.fn();
  renderBar();
  fireEvent.change(input(), { target: { value: "tacos" } });

  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(await screen.findByText("Results for tacos")).toBeInTheDocument();
  expect(screen.queryByText("Every restaurant")).not.toBeInTheDocument();
  // The results page runs the search. The bar running it too sent every
  // search twice, and a failed one emptied the page already open (#108).
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test("a keyword with % & / + in it arrives at its results intact", async () => {
  renderBar();
  fireEvent.change(input(), { target: { value: "100% beef & 24/7 c++" } });

  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(await screen.findByText("Results for 100% beef & 24/7 c++")).toBeInTheDocument();
});

test("Enter in the empty box browses too", async () => {
  renderBar();
  fireEvent.submit(input());
  await waitFor(() => expect(screen.getByText("Every restaurant")).toBeInTheDocument());
});
