import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers } from "redux";
import { MemoryRouter, Route } from "react-router-dom";
import Navigation from "./index";

/**
 * The nav's Log In and Sign Up remember the page they were clicked on, so
 * the login or signup page can send you back to it (#135).
 */

let where: any;

function renderNavAt(entry: any) {
  const store = createStore(combineReducers({ session: (state = { user: null }) => state }));
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[entry]}>
        <Navigation />
        <Route path="*" render={({ location }) => { where = location; return null; }} />
      </MemoryRouter>
    </Provider>
  );
}

test.each(["Log In", "Sign Up"])("%s, clicked on a restaurant, carries the restaurant along", (name) => {
  renderNavAt("/single/2?tab=photos#top");

  fireEvent.click(screen.getByRole("link", { name }));

  expect(where.pathname).toBe(name === "Log In" ? "/login" : "/signup");
  expect(where.state).toEqual({ from: "/single/2?tab=photos#top" });
});

test("clicked on the login page itself, it passes on where that came from", () => {
  renderNavAt({ pathname: "/login", state: { from: "/single/5" } });

  fireEvent.click(screen.getByRole("link", { name: "Sign Up" }));

  expect(where.pathname).toBe("/signup");
  expect(where.state).toEqual({ from: "/single/5" });
});

test("the links still go to /login and /signup", () => {
  renderNavAt("/restaurants");
  expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login");
  expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/signup");
});
