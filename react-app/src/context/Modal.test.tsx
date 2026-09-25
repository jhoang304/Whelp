import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModalProvider, Modal } from "./Modal";
import OpenModalButton from "../components/OpenModalButton";
import Lightbox from "../components/Lightbox";

/**
 * The modal behaves as a dialog: it is announced as one, by its heading;
 * focus goes into it and comes back out; Tab stays inside; Escape closes it.
 *
 * jsdom has no layout and no default Tab behaviour, so what can be checked is
 * the part the app does itself -- wrapping at the two edges. Walking between
 * the fields in the middle is the browser's job.
 */

function Form() {
  return (
    <form>
      <h2>Add Something</h2>
      <input aria-label="First" />
      <input aria-label="Second" />
      <button type="submit">Save</button>
    </form>
  );
}

function renderWith(content: React.ReactElement, onModalClose?: () => void) {
  return render(
    <ModalProvider>
      <button>Before</button>
      <OpenModalButton buttonText="Open" modalComponent={content} onModalClose={onModalClose} />
      <Modal />
    </ModalProvider>
  );
}

test("it is a modal dialog, named by its heading, and focus moves into it", () => {
  renderWith(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  const dialog = screen.getByRole("dialog", { name: "Add Something" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(screen.getByLabelText("First")).toHaveFocus();
});

function LoadsFirst() {
  const [loaded, setLoaded] = useState(false);
  return loaded
    ? <h2>Photos for Somewhere</h2>
    : <button type="button" onClick={() => setLoaded(true)}>Loading...</button>;
}

test("a heading that only appears once the content has loaded still names it", async () => {
  renderWith(<LoadsFirst />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-labelledby");

  fireEvent.click(screen.getByRole("button", { name: "Loading..." }));

  // A MutationObserver reports on a microtask, so this is found, not got.
  expect(await screen.findByRole("dialog", { name: "Photos for Somewhere" })).toBeInTheDocument();
});

test("Escape closes it and focus returns to the button that opened it", () => {
  const onModalClose = jest.fn();
  renderWith(<Form />, onModalClose);
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);

  fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onModalClose).toHaveBeenCalledTimes(1);
  expect(opener).toHaveFocus();
});

test("if closing moves focus somewhere on purpose, it is left there", () => {
  // The profile menu does this: the item that opened the modal is hidden by
  // the time the modal closes, so the menu sends focus to its own button.
  // React is what keeps it there -- it restores the focus it saw before a
  // commit -- and this pins that the dialog's own restore never undoes it.
  renderWith(<Form />, () => screen.getByRole("button", { name: "Before" }).focus());
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);

  fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

  expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
});

test("Tab past the last control comes back to the first, and Shift+Tab the other way", () => {
  renderWith(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const first = screen.getByLabelText("First");
  const save = screen.getByRole("button", { name: "Save" });

  save.focus();
  fireEvent.keyDown(save, { key: "Tab" });
  expect(first).toHaveFocus();

  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(save).toHaveFocus();
});

test("focus that has wandered outside is brought back in by Tab", () => {
  renderWith(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const before = screen.getByRole("button", { name: "Before" });

  before.focus();
  fireEvent.keyDown(before, { key: "Tab" });

  expect(screen.getByLabelText("First")).toHaveFocus();
});

function PhotosWithViewer() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <h2>Photos</h2>
      <button type="button" onClick={() => setOpen(true)}>Enlarge</button>
      {open && (
        <Lightbox
          photos={[{ url: "a.png", alt: "A" }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

test("with a photo enlarged inside the modal, Escape closes the photo and not the modal", () => {
  renderWith(<PhotosWithViewer />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const enlarge = screen.getByRole("button", { name: "Enlarge" });
  enlarge.focus();
  fireEvent.click(enlarge);

  // The viewer takes focus, on its close button.
  expect(screen.getByRole("button", { name: "Close image viewer" })).toHaveFocus();

  fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

  expect(screen.queryByRole("dialog", { name: "Photo viewer" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Photos" })).toBeInTheDocument();
  expect(enlarge).toHaveFocus();

  // And the next Escape is the modal's.
  fireEvent.keyDown(enlarge, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("the button that opens a modal does not submit the form it sits in", () => {
  const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <ModalProvider>
      <form onSubmit={onSubmit}>
        <OpenModalButton buttonText="Open" modalComponent={<h2>Hi</h2>} />
      </form>
      <Modal />
    </ModalProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: "Open" }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Hi" })).toBeInTheDocument();
});
