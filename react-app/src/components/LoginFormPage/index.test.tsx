import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import LoginFormPage from "./index";
import SignupFormPage from "../SignupFormPage";

/**
 * The email boxes are email boxes: a phone's keyboard then doesn't
 * capitalise the first letter, and a password manager knows what to fill.
 * "Owner@test.io" was a failed login before #117.
 */

function renderPage(page: React.ReactElement) {
  const store = createStore(combineReducers({ session: (state = { user: null }) => state }), applyMiddleware(thunk));
  return render(
    <Provider store={store as any}>
      <MemoryRouter>{page}</MemoryRouter>
    </Provider>
  );
}

test("the login page's email box is an email box that isn't capitalised", () => {
  renderPage(<LoginFormPage />);
  const email = document.getElementById("email") as HTMLInputElement;
  expect(email).toHaveAttribute("type", "email");
  expect(email).toHaveAttribute("autocapitalize", "none");
  expect(email).toHaveAttribute("autocomplete", "email");
  expect(document.getElementById("password")).toHaveAttribute("autocomplete", "current-password");
});

test("the signup page's email and username boxes aren't capitalised either", () => {
  renderPage(<SignupFormPage />);
  expect(document.getElementById("email")).toHaveAttribute("autocapitalize", "none");
  expect(document.getElementById("email")).toHaveAttribute("autocomplete", "email");
  expect(document.getElementById("username")).toHaveAttribute("autocapitalize", "none");
  expect(screen.getAllByLabelText(/password/i).every((box) => box.getAttribute("autocomplete") === "new-password")).toBe(true);
});
