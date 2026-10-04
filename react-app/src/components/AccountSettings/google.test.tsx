import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter, Route } from "react-router-dom";
import session from "../../store/session";
import { ModalProvider, Modal } from "../../context/Modal";
import AccountSettings from "./index";
import { navigateTo } from "../../utils/google";
import { axe } from "../../testUtils/axe";
import type { Mock } from "vitest";

/**
 * Google, on Account settings: connecting it to an account with a password
 * (which asks for the password), disconnecting it, and an account made with
 * Google confirming with Google where others give a password.
 */

vi.mock("../../utils/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/google")>()),
  navigateTo: vi.fn(),
}));

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (status: number, errors: string[]) =>
  ({ ok: false, status, json: () => Promise.resolve({ errors }) });

const SUMMARY = { restaurants: [], reviewsKept: 0, photos: 0, favorites: 0, isDemo: false };
const RITA = { id: 9, username: "rita", email: "rita@test.io", hasPassword: true, googleConnected: false };
const CONNECTED = { ...RITA, googleConnected: true };
const GOOGLE_ONLY = { ...RITA, hasPassword: false, googleConnected: true };
const GOOGLE_PAGE = "https://accounts.google.com/o/oauth2/v2/auth?state=s";

/** The API, by "METHOD /path": the summary and Google's status unless a test says otherwise. */
function serve(routes: Record<string, (options: any) => any>, status = { available: true, confirmed: false }) {
  (global as any).fetch = vi.fn((url: string, options: any = {}) => {
    const route = `${(options.method ?? "GET").toUpperCase()} ${url}`;
    if (routes[route]) return Promise.resolve(routes[route](options));
    if (route === "GET /api/users/9/deletion") return Promise.resolve(okJson(SUMMARY));
    if (route === "GET /api/auth/google") return Promise.resolve(okJson(status));
    return Promise.resolve(refused(404, ["Not found"]));
  });
}

const sent = (route: string) => {
  const [method, url] = route.split(" ");
  const call = ((global as any).fetch as Mock).mock.calls
    .find(([calledUrl, options]) => calledUrl === url && (options?.method ?? "GET") === method);
  return call && call[1]?.body !== undefined ? JSON.parse(call[1].body) : call;
};

let where: any;

function renderPage(user: any, entry = "/settings") {
  const store = createStore(combineReducers({ session }), { session: { user } } as any, applyMiddleware(thunk));
  const view = render(
    <Provider store={store as any}>
      <MemoryRouter initialEntries={[entry]}>
        <ModalProvider>
          <AccountSettings />
          <Modal />
        </ModalProvider>
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

// --- connecting ------------------------------------------------------------------------

test("an account with a password connects Google after giving it again", async () => {
  serve({ "POST /api/auth/google/connect": () => okJson({ url: GOOGLE_PAGE }) });
  renderPage(RITA);
  await screen.findByRole("heading", { name: "Google" });

  fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
  expect(screen.getByText("Enter your password to connect Google.")).toBeInTheDocument();
  expect(sent("POST /api/auth/google/connect")).toBeUndefined();

  type("Password", "password");
  fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
  await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(GOOGLE_PAGE));
  expect(sent("POST /api/auth/google/connect")).toEqual({ password: "password" });
  expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();
});

test("a refused connection says why, and can be tried again", async () => {
  serve({ "POST /api/auth/google/connect": () => refused(400, ["That password is incorrect."]) });
  renderPage(RITA);
  await screen.findByRole("heading", { name: "Google" });

  type("Password", "not-it");
  fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
  expect(await screen.findByText("That password is incorrect.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Connect Google" })).toBeEnabled();
  expect(navigateTo).not.toHaveBeenCalled();
});

test("with Google not set up, there's nothing to connect", async () => {
  serve({}, { available: false, confirmed: false });
  renderPage(RITA);
  await waitFor(() => expect(sent("GET /api/auth/google")).toBeDefined());
  await screen.findByText("Your profile and profile picture.");
  expect(screen.queryByRole("heading", { name: "Google" })).not.toBeInTheDocument();
});

test("connected, an account with a password can disconnect", async () => {
  serve({ "DELETE /api/auth/google": () => okJson({ ...CONNECTED, googleConnected: false }) });
  const { store } = renderPage(CONNECTED);
  expect(await screen.findByText(/you can log in with it or with your password/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
  expect(await screen.findByRole("button", { name: "Connect Google" })).toBeInTheDocument();
  expect((store.getState() as any).session.user.googleConnected).toBe(false);
});

// --- an account made with Google --------------------------------------------------------

test("an account made with Google confirms with Google, where others give a password", async () => {
  serve({});
  const { container } = renderPage(GOOGLE_ONLY);
  expect(await screen.findByRole("heading", { name: "Set a password" })).toBeInTheDocument();
  expect(screen.getByText("Your Google account is connected, and it's how you log in.")).toBeInTheDocument();

  const confirms = screen.getAllByRole("link", { name: "Confirm with Google" });
  expect(confirms).toHaveLength(2);
  for (const link of confirms) expect(link).toHaveAttribute("href", "/api/auth/google/start?intent=confirm");
  expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Your password")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Disconnect Google" })).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

test("confirmed, it sets a first password, with no current one to give", async () => {
  serve({ "PUT /api/users/9/password": () => okJson({ message: "Your password has been set." }) },
    { available: true, confirmed: true });
  const { store } = renderPage(GOOGLE_ONLY);
  await screen.findByRole("button", { name: "Set password" });

  type("New password", "short");
  type("Confirm new password", "short");
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
  expect(screen.queryByText("Enter your current password.")).not.toBeInTheDocument();

  type("New password", "a-new-password");
  type("Confirm new password", "a-new-password");
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText(/Your password has been set/)).toBeInTheDocument();
  expect(sent("PUT /api/users/9/password")).toEqual({ new_password: "a-new-password" });
  expect((store.getState() as any).session.user.hasPassword).toBe(true);
  // From now on, it's changed like anyone's.
  expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  expect(screen.getByLabelText("Current password")).toBeInTheDocument();
});

test("confirmed, it deletes with no password, after the same confirmation", async () => {
  serve({ "DELETE /api/users/9": () => okJson({ message: "Your account has been deleted." }) },
    { available: true, confirmed: true });
  const { store } = renderPage(GOOGLE_ONLY);

  fireEvent.click(await screen.findByRole("button", { name: "Delete my account" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
  fireEvent.click(dialog.querySelector(".delete-button") as HTMLElement);

  expect(await screen.findByRole("heading", { name: "Your account has been deleted" })).toBeInTheDocument();
  expect(sent("DELETE /api/users/9")).toEqual({});
  expect((store.getState() as any).session.user).toBeNull();
});

// --- back from Google ---------------------------------------------------------------------

test("back from Google, the page says it's connected, once", async () => {
  serve({});
  renderPage(CONNECTED, "/settings?google=connected");
  expect(screen.getByRole("status")).toHaveTextContent("Google is connected. You can log in with it from now on.");
  await waitFor(() => expect(where.search).toBe(""));
});

test("or why it isn't", async () => {
  serve({});
  renderPage(RITA, "/settings?google=in-use");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "That Google account is already connected to another Whelp account.");
});
