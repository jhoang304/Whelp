import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import LoginFormPage from "./index";
import SignupFormPage from "../SignupFormPage";
import { axe } from "../../testUtils/axe";

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

test("signup's name and username boxes say what they are, for autofill", () => {
  renderPage(<SignupFormPage />);
  expect(document.getElementById("first_name")).toHaveAttribute("autocomplete", "given-name");
  expect(document.getElementById("last_name")).toHaveAttribute("autocomplete", "family-name");
  expect(document.getElementById("username")).toHaveAttribute("autocomplete", "username");
});

// --- a refused login is said, and stays said (#122) ----------------------------------

const refuse = (errors: string[]) => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: false, status: 401, json: () => Promise.resolve({ errors }),
  }));
};

afterEach(() => {
  jest.useRealTimers();
  delete (global as any).fetch;
});

test("a refused login is announced, in the form, and marks both fields", async () => {
  refuse(["Invalid credentials"]);
  const { container } = renderPage(<LoginFormPage />);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "nobody@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Invalid credentials");
  expect(alert.closest("form")).not.toBeNull();
  for (const field of [screen.getByLabelText("Email Address"), screen.getByLabelText("Password")]) {
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Invalid credentials");
  }
  expect(await axe(container)).toHaveNoViolations();
});

test("the message stays until the next try, and every error is shown", async () => {
  // Fake from the start, so a timer set when the message appears is one this
  // test can run out.
  jest.useFakeTimers();
  refuse(["Email is required.", "Password is required."]);
  renderPage(<LoginFormPage />);
  fireEvent.click(screen.getByRole("button", { name: "Log in as Demo User" }));
  await screen.findByRole("alert");

  // The toast it replaced went after four seconds.
  act(() => { jest.advanceTimersByTime(10000); });
  expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");
  expect(screen.getByRole("alert")).toHaveTextContent("Password is required.");
});

test("the login and signup pages have nothing axe objects to", async () => {
  const { container, unmount } = renderPage(<LoginFormPage />);
  expect(await axe(container)).toHaveNoViolations();
  unmount();
  const signup = renderPage(<SignupFormPage />);
  expect(await axe(signup.container)).toHaveNoViolations();
});

test("signup's errors are announced too", async () => {
  renderPage(<SignupFormPage />);
  for (const [label, value] of [["First Name", "Test"], ["Last Name", "Person"], ["Email Address", "t@example.test"],
    ["Username", "tester"], ["Password", "abc"], ["Confirm Password", "abc"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Password must be at least 8 characters.");
});
