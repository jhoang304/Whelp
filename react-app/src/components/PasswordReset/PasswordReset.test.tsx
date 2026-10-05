import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import session from "../../store/session";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
import { axe } from "../../testUtils/axe";
import { deferredFetch } from "../../testUtils/deferredFetch";
import type { Mock } from "vitest";

/**
 * Asking for a reset link, and using one: what's sent, what's said back,
 * and that the token in the link doesn't stay in the address bar.
 */

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (status: number, errors: string[]) =>
  ({ ok: false, status, json: () => Promise.resolve({ errors }) });

const SENT = "If an account uses that address, we've emailed it a link to reset the password. The link works for an hour.";
const EXPIRED = "This link has expired or has already been used. Ask for a new one.";
const OLIVE = { id: 3, username: "owner", email: "owner@test.io", first_name: "Olive", last_name: "Owner" };

/** The API, by "METHOD /path". */
function serve(routes: Record<string, (options: any) => any>) {
  (global as any).fetch = vi.fn((url: string, options: any = {}) => {
    const route = `${(options.method ?? "GET").toUpperCase()} ${url}`;
    return Promise.resolve(routes[route] ? routes[route](options) : refused(404, ["Not found"]));
  });
}

const sent = (route: string) => {
  const [method, url] = route.split(" ");
  const call = ((global as any).fetch as Mock).mock.calls
    .find(([calledUrl, options]) => calledUrl === url && (options?.method ?? "GET") === method);
  return call ? JSON.parse(call[1].body) : undefined;
};

let where: any;

function renderAt(entry: any, page: React.ReactElement) {
  const store = createStore(combineReducers({ session }), applyMiddleware(thunk));
  const view = render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[entry]}>
        {page}
        <Route path="*" render={({ location }) => { where = location; return null; }} />
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  delete (global as any).fetch;
});

// --- asking for a link ----------------------------------------------------------------

test("it brings the address typed at login, and says the email is on its way", async () => {
  serve({ "POST /api/auth/password-reset": () => okJson({ message: SENT }) });
  const { container } = renderAt({ pathname: "/forgot-password", state: { email: "owner@test.io" } },
    <ForgotPasswordPage />);
  expect(screen.getByLabelText("Email Address")).toHaveValue("owner@test.io");
  expect(await axe(container)).toHaveNoViolations();

  fireEvent.click(screen.getByRole("button", { name: "Email me a link" }));
  expect(await screen.findByRole("status")).toHaveTextContent(SENT);
  expect(sent("POST /api/auth/password-reset")).toEqual({ email: "owner@test.io" });
  expect(document.title).toBe("Reset your password · Whelp");
});

test("an empty address is caught before anything is sent", () => {
  serve({});
  renderAt("/forgot-password", <ForgotPasswordPage />);
  fireEvent.click(screen.getByRole("button", { name: "Email me a link" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address.");
  expect(screen.getByLabelText("Email Address")).toHaveAttribute("aria-invalid", "true");
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test("a refusal is shown, and the address can be tried again", async () => {
  serve({ "POST /api/auth/password-reset": () => refused(429, ["Too many requests. Try again later."]) });
  renderAt("/forgot-password", <ForgotPasswordPage />);
  type("Email Address", "owner@test.io");
  fireEvent.click(screen.getByRole("button", { name: "Email me a link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Try again later.");
  expect(screen.getByRole("button", { name: "Email me a link" })).toBeEnabled();
});

test("after sending, another address can be tried", async () => {
  serve({ "POST /api/auth/password-reset": () => okJson({ message: SENT }) });
  renderAt("/forgot-password", <ForgotPasswordPage />);
  type("Email Address", "owner@test.io");
  fireEvent.click(screen.getByRole("button", { name: "Email me a link" }));
  fireEvent.click(await screen.findByRole("button", { name: "try a different address" }));
  expect(screen.getByLabelText("Email Address")).toHaveValue("owner@test.io");
});

// --- using one ------------------------------------------------------------------------

test("a link with no token says so, and asks nothing of the server", () => {
  serve({});
  renderAt("/reset-password", <ResetPasswordPage />);
  expect(screen.getByRole("heading", { name: "This link can't be used" })).toBeInTheDocument();
  expect(screen.getByText("This link is incomplete. Open the one in the email again.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/forgot-password");
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test("nothing is asked for until the link has been checked", async () => {
  const server = deferredFetch();
  renderAt("/reset-password#old.token", <ResetPasswordPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking your link...");
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();

  server.answer((url) => url === "/api/auth/password-reset/check", refused(400, [EXPIRED]));
  expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

test("an expired or used link says so, with a way to a new one", async () => {
  serve({ "POST /api/auth/password-reset/check": () => refused(400, [EXPIRED]) });
  renderAt("/reset-password#old.token", <ResetPasswordPage />);
  expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
  expect(sent("POST /api/auth/password-reset/check")).toEqual({ token: "old.token" });
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

test("the token comes out of the address bar as soon as it's read", async () => {
  serve({ "POST /api/auth/password-reset/check": () => okJson({ valid: true }) });
  renderAt("/reset-password#the.token.here", <ResetPasswordPage />);
  await waitFor(() => expect(where.hash).toBe(""));
  expect(where.pathname).toBe("/reset-password");
  await screen.findByLabelText("New password");
  expect(sent("POST /api/auth/password-reset/check")).toEqual({ token: "the.token.here" });
});

test("a good link takes a new password, and signs you in", async () => {
  serve({
    "POST /api/auth/password-reset/check": () => okJson({ valid: true }),
    "PUT /api/auth/password-reset": () => okJson(OLIVE),
  });
  const { store, container } = renderAt("/reset-password#good.token", <ResetPasswordPage />);
  await screen.findByRole("heading", { name: "Choose a new password" });
  expect(await axe(container)).toHaveNoViolations();

  type("New password", "short");
  type("Confirm new password", "shorts");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
  expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
  expect(screen.getByText("The new passwords don't match.")).toBeInTheDocument();
  expect(sent("PUT /api/auth/password-reset")).toBeUndefined();

  type("New password", "a-new-password");
  type("Confirm new password", "a-new-password");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
  expect(await screen.findByRole("heading", { name: "Your password has been reset" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("You're logged in with your new password.");
  expect(sent("PUT /api/auth/password-reset")).toEqual({ token: "good.token", new_password: "a-new-password" });
  expect((store.getState() as any).session.user).toEqual(OLIVE);
  expect(screen.getByRole("link", { name: "Go to Whelp" })).toHaveAttribute("href", "/");
});

test("a refusal at the last step is shown", async () => {
  serve({
    "POST /api/auth/password-reset/check": () => okJson({ valid: true }),
    "PUT /api/auth/password-reset": () => refused(400, [EXPIRED]),
  });
  const { store } = renderAt("/reset-password#good.token", <ResetPasswordPage />);
  await screen.findByLabelText("New password");
  type("New password", "a-new-password");
  type("Confirm new password", "a-new-password");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(EXPIRED);
  expect((store.getState() as any).session.user).toBeNull();
});
