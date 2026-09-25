import { render, screen, fireEvent } from "@testing-library/react";
import { ModalProvider, Modal } from "../../context/Modal";
import OpenModalButton from "../OpenModalButton";
import ConfirmDeleteModal from "./index";

/**
 * Deleting a review or a response used to go through window.confirm. It goes
 * through this modal now, as restaurants always did, and nothing is deleted
 * until its red button is pressed.
 */

function renderDelete(onConfirm: () => void) {
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
  const onConfirm = jest.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  expect(screen.getByRole("dialog", { name: "Delete Review" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
});

test("Cancel closes it without deleting", () => {
  const onConfirm = jest.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("the red button deletes, once, and closes it", () => {
  const onConfirm = jest.fn();
  renderDelete(onConfirm);
  fireEvent.click(screen.getByRole("button", { name: "Delete Review" }));

  const dialog = screen.getByRole("dialog");
  fireEvent.click(dialog.querySelector(".delete-button") as HTMLElement);

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
