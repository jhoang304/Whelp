import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import { ModalProvider } from "../../context/Modal";
import ProfileButton from "./ProfileButton";

/**
 * The menu would open and shut again inside one click: React 18 flushes the
 * effect that attaches the outside-click listener while that same click is
 * still travelling up to the document, so the listener saw the click that had
 * just opened the menu and treated it as a click elsewhere.
 *
 * None of the tests below would have caught that, and they are not claimed to.
 * jsdom cannot reproduce it: Testing Library flushes effects only after the
 * event has finished propagating, so the listener is never attached in time.
 * Run against the broken component, every behavioural assertion here passes --
 * including the two-click one, which the old code satisfied by accident, the
 * second click closing the menu through the outside-click path rather than by
 * toggling. A real browser is what showed the bug and what confirmed the fix.
 *
 * What these do is pin the contract the fix rests on -- the button toggles,
 * reports its state, and is not itself "outside" -- so that a later change
 * cannot quietly walk any of it back.
 */

const user = {
  id: 1,
  username: "Demo",
  email: "demo@aa.io",
  first_name: "Demo",
  last_name: "User",
  profile_image_url: null,
};

function renderButton() {
  const store = createStore(
    combineReducers({ session: (state = { user }) => state }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <ProfileButton user={user as any} />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
}

const menu = () => screen.getByText("Log Out").closest("ul") as HTMLElement;
const button = () => screen.getByRole("button", { name: /user menu/i });

test("the menu starts closed", () => {
  renderButton();
  expect(menu()).toHaveClass("hidden");
  expect(button()).toHaveAttribute("aria-expanded", "false");
});

test("clicking the button opens the menu", () => {
  renderButton();

  fireEvent.click(button());

  expect(menu()).not.toHaveClass("hidden");
  expect(button()).toHaveAttribute("aria-expanded", "true");
});

test("clicking the button again closes it", () => {
  // The button toggles rather than only opening, which is what lets the
  // outside-click listener ignore it: without the toggle, ignoring the button
  // would leave no way to shut the menu from the button at all.
  renderButton();

  fireEvent.click(button());
  fireEvent.click(button());

  expect(menu()).toHaveClass("hidden");
});

test("a click on the icon inside the button counts as the button", () => {
  // The listener asks whether the click landed on the button, and the click
  // usually lands on the icon inside it -- `contains`, not `===`.
  renderButton();
  fireEvent.click(button());

  const icon = button().querySelector("i") as HTMLElement;
  fireEvent.click(icon);

  expect(menu()).toHaveClass("hidden");
  expect(button()).toHaveAttribute("aria-expanded", "false");
});

test("clicking outside closes the menu", () => {
  renderButton();
  fireEvent.click(button());

  fireEvent.click(document.body);

  expect(menu()).toHaveClass("hidden");
});

test("Escape closes the menu and puts focus back on the button", () => {
  renderButton();
  fireEvent.click(button());
  const logOut = screen.getByRole("button", { name: /log out/i });
  logOut.focus();

  fireEvent.keyDown(logOut, { key: "Escape" });

  expect(menu()).toHaveClass("hidden");
  expect(button()).toHaveFocus();
});

test("the menu is a list of list items", () => {
  // It held divs and buttons directly, which a screen reader announces as a
  // list with no items in it.
  renderButton();
  const children = Array.from(menu().children);
  expect(children.length).toBeGreaterThan(0);
  children.forEach((child) => expect(child.tagName).toBe("LI"));
});
