import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModalProvider, Modal } from "../../context/Modal";
import OpenModalButton from "../OpenModalButton";
import ConfirmDeleteModal from "./index";

/**
 * Deleting a review or a response used to go through window.confirm. It goes
 * through this modal now, as restaurants always did, and nothing is deleted
 * until its red button is pressed.
 */

function renderDelete(onConfirm: () => any) {
  return render(
    <ModalProvider>
      <OpenModalButton
        buttonText="Delete Review"
        modalComponent={
          <ConfirmDeleteModal
            title="Delete Review"
            message="Delete your review?"
            detail="This cannot be undone."
            confirmLabel="Delete Review"
            onConfirm={onConfirm}
          />
        }
      />
      <Modal />
    </ModalProvider>
  );
}

test("it opens on Cancel, so Enter straight away deletes nothing", () => {
  const onConfirm = vi.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  expect(screen.getByRole("dialog", { name: "Delete Review" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
});

test("Cancel closes it without deleting", () => {
  const onConfirm = vi.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("the red button deletes, once, and closes it", async () => {
  const onConfirm = vi.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  const dialog = screen.getByRole("dialog");
  fireEvent.click(dialog.querySelector(".delete-button") as HTMLElement);

  expect(onConfirm).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

// --- a delete that fails (#116) ----------------------------------------------------

const redButton = () => screen.getByRole("dialog").querySelector(".delete-button") as HTMLElement;

test("a refused delete keeps the dialog open and says why", async () => {
  renderDelete(() => Promise.resolve(["You can only delete your own reviews"]));
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  fireEvent.click(redButton());

  expect(await screen.findByRole("alert")).toHaveTextContent("You can only delete your own reviews");
  expect(screen.getByRole("dialog", { name: "Delete Review" })).toBeInTheDocument();
  // And it can be tried again, or cancelled.
  expect(redButton()).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
});

test("while it deletes, neither button can be pressed again", async () => {
  let finish: (value: null) => void = () => {};
  const onConfirm = vi.fn(() => new Promise<null>((resolve) => { finish = resolve; }));
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  fireEvent.click(redButton());

  expect(redButton()).toBeDisabled();
  expect(redButton()).toHaveTextContent("Deleting...");
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.click(redButton());
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await act(async () => finish(null));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("a delete that throws is reported, not swallowed", async () => {
  renderDelete(() => Promise.reject(new TypeError("Failed to fetch")));
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  fireEvent.click(redButton());

  expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
