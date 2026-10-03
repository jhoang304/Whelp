import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import UpdateProfile from "./UpdateProfile";
import { axe } from "../../testUtils/axe";

/** A pasted profile picture link is held to what the API takes before it is sent (#114). */

vi.mock("../../context/Modal", () => ({
  useModal: () => ({ closeModal: vi.fn() }),
}));

const user = {
  id: 2, username: "rita", first_name: "Rita", last_name: "Reviewer", profile_image_url: null,
  restaurants: [], restaurant_count: 0, review_count: 0,
};

afterEach(() => {
  delete (global as any).fetch;
});

test("a link longer than the API takes is refused without a request", async () => {
  (global as any).fetch = vi.fn();
  const store = createStore(combineReducers({ session: (state = { user }) => state }), applyMiddleware(thunk));
  render(
    <Provider store={store as any}>
      <UpdateProfile user={user as any} />
    </Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Use a URL" }));
  fireEvent.change(screen.getByLabelText("Photo URL"), {
    target: { value: "https://cdn.example.com/" + "a".repeat(300) + ".jpg" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Profile picture URL must be 255 characters or fewer.")).toBeInTheDocument();
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test("a save that can't reach the server gives the form back, saying so", async () => {
  (global as any).fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  const store = createStore(combineReducers({ session: (state = { user }) => state }), applyMiddleware(thunk));
  render(
    <Provider store={store as any}>
      <UpdateProfile user={user as any} />
    </Provider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Couldn't reach the server. Check your connection and try again.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
});

test("a name cleared to spaces is refused here, not quietly kept by the API", async () => {
  // It used to "save": the modal closed, and the old name came back (#117).
  (global as any).fetch = vi.fn();
  const store = createStore(combineReducers({ session: (state = { user }) => state }), applyMiddleware(thunk));
  render(
    <Provider store={store as any}>
      <UpdateProfile user={user as any} />
    </Provider>
  );

  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("First name is required.")).toBeInTheDocument();
  expect(screen.getByText("Last name is required.")).toBeInTheDocument();
  expect((global as any).fetch).not.toHaveBeenCalled();
});

// --- what a screen reader and autofill get (#122) ------------------------------------

function renderForm() {
  const store = createStore(combineReducers({ session: (state = { user }) => state }), applyMiddleware(thunk));
  return render(
    <Provider store={store as any}>
      <UpdateProfile user={user as any} />
    </Provider>
  );
}

test("the boxes say what they hold, for autofill", () => {
  renderForm();
  expect(screen.getByLabelText("Username")).toHaveAttribute("autocomplete", "username");
  expect(screen.getByLabelText("First name")).toHaveAttribute("autocomplete", "given-name");
  expect(screen.getByLabelText("Last name")).toHaveAttribute("autocomplete", "family-name");
  fireEvent.click(screen.getByRole("button", { name: "Use a URL" }));
  expect(screen.getByLabelText("Photo URL")).toHaveAttribute("autocomplete", "photo");
});

test("a refusal is announced, and the form has nothing axe objects to", async () => {
  (global as any).fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  const { container } = renderForm();
  expect(await axe(container)).toHaveNoViolations();

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server.");
  expect(await axe(container)).toHaveNoViolations();
});
