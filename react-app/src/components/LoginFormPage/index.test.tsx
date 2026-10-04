import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route, Switch } from "react-router-dom";
import session from "../../store/session";
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
  (global as any).fetch = vi.fn(() => Promise.resolve({
    ok: false, status: 401, json: () => Promise.resolve({ errors }),
  }));
};

afterEach(() => {
  vi.useRealTimers();
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
  // test can run out. Moving with real time as well, so findByRole's own
  // polling still runs: Testing Library only drives the fake clock under Jest.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  refuse(["Email is required.", "Password is required."]);
  renderPage(<LoginFormPage />);
  fireEvent.click(screen.getByRole("button", { name: "Log in as Demo User" }));
  await screen.findByRole("alert");

  // The toast it replaced went after four seconds.
  act(() => { vi.advanceTimersByTime(10000); });
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

// --- back to the page you were on (#135) ------------------------------------------------

const DEMO = { id: 1, username: "Demo", email: "demo@aa.io", first_name: "Demo", last_name: "User" };

/** Logging in and signing up both succeed, as Demo. */
const succeed = () => {
  (global as any).fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DEMO) }));
};

let where: any;
let routerHistory: any;

/** Both pages, with a real session, opened at `entry`; `where` follows the address. */
function renderFlow(entry: any) {
  const store = createStore(combineReducers({ session }), applyMiddleware(thunk));
  return render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[entry]}>
        <Switch>
          <Route exact path="/login"><LoginFormPage /></Route>
          <Route exact path="/signup"><SignupFormPage /></Route>
          <Route path="*"><p>Somewhere else</p></Route>
        </Switch>
        <Route path="*" render={({ location, history }) => { where = location; routerHistory = history; return null; }} />
      </MemoryRouter>
    </Provider>
  );
}

const address = () => `${where.pathname}${where.search}${where.hash}`;

test("logging in from a restaurant goes back to it", async () => {
  succeed();
  renderFlow({ pathname: "/login", state: { from: "/single/2?tab=photos#top" } });

  fireEvent.click(screen.getByRole("button", { name: "Log in as Demo User" }));

  await waitFor(() => expect(address()).toBe("/single/2?tab=photos#top"));
  expect(screen.getByText("Somewhere else")).toBeInTheDocument();
});

test("logging in at /login, arrived at directly, still goes home", async () => {
  succeed();
  renderFlow("/login");

  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "demo@aa.io" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));

  await waitFor(() => expect(address()).toBe("/"));
});

test("a from that would leave the site goes home instead", async () => {
  succeed();
  renderFlow({ pathname: "/login", state: { from: "//elsewhere.example/phish" } });

  fireEvent.click(screen.getByRole("button", { name: "Log in as Demo User" }));

  await waitFor(() => expect(address()).toBe("/"));
});

test("from login to signup and signing up there, it still goes back where you started", async () => {
  succeed();
  renderFlow({ pathname: "/login", state: { from: "/single/2" } });

  fireEvent.click(screen.getByRole("link", { name: "Sign Up" }));
  expect(where.pathname).toBe("/signup");
  expect(where.state).toEqual({ from: "/single/2" });

  for (const [label, value] of [["First Name", "New"], ["Last Name", "Person"], ["Email Address", "new@example.test"],
    ["Username", "newperson"], ["Password", "password123"], ["Confirm Password", "password123"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

  await waitFor(() => expect(address()).toBe("/single/2"));
});

test("signup's Log In link passes it on too", () => {
  renderFlow({ pathname: "/signup", state: { from: "/settings" } });

  fireEvent.click(screen.getByRole("link", { name: "Log In" }));

  expect(where.pathname).toBe("/login");
  expect(where.state).toEqual({ from: "/settings" });
});

test("the login form gives its place in the history to the page it returns to", async () => {
  succeed();
  renderFlow({ pathname: "/login", state: { from: "/single/2" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in as Demo User" }));
  await waitFor(() => expect(address()).toBe("/single/2"));

  // Replaced, not pushed on top: Back never lands on a login form for
  // someone already logged in.
  expect(routerHistory.action).toBe("REPLACE");
  expect(routerHistory.entries.map((entry: any) => entry.pathname)).toEqual(["/single/2"]);
});
