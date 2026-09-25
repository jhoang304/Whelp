import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import session from "../../store/session";
import { ModalProvider, Modal } from "../../context/Modal";
import AccountSettings from "./index";

/**
 * /settings: a password change that checks what it can before asking, and a
 * deletion that says exactly what goes, asks for the password, and asks
 * once more before anything is sent.
 */

const okJson = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const refused = (status: number, errors: string[]) =>
  ({ ok: false, status, json: () => Promise.resolve({ errors }) });

const SUMMARY = {
  restaurants: [{ id: 4, name: "Nancy's Hustle", reviews: 3 }],
  reviewsKept: 2,
  photos: 5,
  favorites: 1,
  isDemo: false,
};

function renderPage(user: any = { id: 9, username: "rita", email: "rita@test.io" }) {
  const store = createStore(
    combineReducers({ session }),
    { session: { user } } as any,
    applyMiddleware(thunk)
  );
  const view = render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <AccountSettings />
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
}

/** fetch that answers the summary, and whatever `rest` says for the rest. */
const withSummary = (rest: (url: string, options: any) => any, summary = SUMMARY) =>
  jest.fn((url: string, options: any = {}) =>
    Promise.resolve(url.endsWith("/deletion") ? okJson(summary) : rest(url, options)));

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  jest.clearAllMocks();
  delete (global as any).fetch;
});

test("someone logged out is pointed at the login page", () => {
  renderPage(null);
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});

// --- the password -------------------------------------------------------------

test("mismatched or short new passwords are caught before anything is sent", async () => {
  (global as any).fetch = withSummary(() => okJson({}));
  renderPage();
  await screen.findByText(/Nancy's Hustle/);

  type("Current password", "old-password");
  type("New password", "short");
  type("Confirm new password", "shorter");
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));

  expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
  expect(screen.getByText("The new passwords don't match.")).toBeInTheDocument();
  expect((global as any).fetch).not.toHaveBeenCalledWith(expect.stringContaining("/password"), expect.anything());
});

test("a good change is sent, confirmed, and the fields are cleared", async () => {
  (global as any).fetch = withSummary(() => okJson({ message: "Your password has been changed." }));
  renderPage();

  type("Current password", "old-password");
  type("New password", "new-password");
  type("Confirm new password", "new-password");
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));

  expect(await screen.findByText("Your password has been changed.")).toBeInTheDocument();
  const call = ((global as any).fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/users/9/password");
  expect(call[1].method).toBe("PUT");
  expect(JSON.parse(call[1].body)).toEqual({ current_password: "old-password", new_password: "new-password" });
  expect(screen.getByLabelText("Current password")).toHaveValue("");
});

test("the API's refusal is shown", async () => {
  (global as any).fetch = withSummary(() => refused(400, ["Your current password is incorrect."]));
  renderPage();

  type("Current password", "wrong-password");
  type("New password", "new-password");
  type("Confirm new password", "new-password");
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));

  expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
  expect(screen.queryByText("Your password has been changed.")).not.toBeInTheDocument();
});

// --- deleting -----------------------------------------------------------------

test("it says what deleting would remove, and what stays", async () => {
  (global as any).fetch = withSummary(() => okJson({}));
  renderPage();

  expect(await screen.findByRole("link", { name: "Nancy's Hustle" })).toHaveAttribute("href", "/single/4");
  expect(screen.getByText(/\(3 reviews\)/)).toBeInTheDocument();
  expect(screen.getByText("5 photos you added.")).toBeInTheDocument();
  expect(screen.getByText("1 saved restaurant.")).toBeInTheDocument();
  expect(screen.getByText(/The 2 reviews you wrote stay/)).toBeInTheDocument();
});

test("without a password nothing is asked or sent", async () => {
  (global as any).fetch = withSummary(() => okJson({}));
  renderPage();
  await screen.findByText(/Nancy's Hustle/);

  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

  expect(screen.getByText("Enter your password to delete your account.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("with it, a confirmation comes first, and only then the delete", async () => {
  (global as any).fetch = withSummary((_url, options) =>
    options.method === "DELETE" ? okJson({ message: "Your account has been deleted." }) : okJson({}));
  const { store } = renderPage();
  await screen.findByText(/Nancy's Hustle/);

  type("Your password", "password");
  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

  const dialog = await screen.findByRole("dialog", { name: "Delete your account?" });
  expect((global as any).fetch).not.toHaveBeenCalledWith("/api/users/9", expect.anything());

  fireEvent.click(dialog.querySelector(".delete-button") as HTMLElement);

  expect(await screen.findByRole("heading", { name: "Your account has been deleted" })).toBeInTheDocument();
  const call = ((global as any).fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/users/9");
  expect(call[1].method).toBe("DELETE");
  expect(JSON.parse(call[1].body)).toEqual({ password: "password" });
  expect((store.getState() as any).session.user).toBeNull();
});

test("a wrong password leaves the account, and says so", async () => {
  (global as any).fetch = withSummary((_url, options) =>
    options.method === "DELETE" ? refused(400, ["That password is incorrect."]) : okJson({}));
  const { store } = renderPage();
  await screen.findByText(/Nancy's Hustle/);

  type("Your password", "not-it");
  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  fireEvent.click((await screen.findByRole("dialog")).querySelector(".delete-button") as HTMLElement);

  expect(await screen.findByText("That password is incorrect.")).toBeInTheDocument();
  expect((store.getState() as any).session.user).not.toBeNull();
});

test("the shared demo account can do neither, and is told why", async () => {
  (global as any).fetch = withSummary(() => okJson({}), { ...SUMMARY, restaurants: [], isDemo: true });
  renderPage({ id: 1, username: "Demo", email: "demo@aa.io" });

  expect(await screen.findByText(/This is the shared demo account/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete my account" })).toBeDisabled());
  expect(screen.getByRole("button", { name: "Change password" })).toBeDisabled();
});
