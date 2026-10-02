import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import InlineConfirm from "./index";
import { axe } from "../../testUtils/axe";

/**
 * "Remove this photo?" asked in place (#131): focus to Cancel, Escape and
 * Cancel take it back and return focus to what asked, and while the delete
 * is under way the buttons wait without dropping focus.
 */

function Harness({ busy = false, onConfirm = jest.fn() }: { busy?: boolean; onConfirm?: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAsking(true)}>Remove</button>
      {asking && (
        <InlineConfirm
          question="Remove this photo?"
          detail="This can't be undone."
          confirmLabel="Remove"
          busyLabel="Removing..."
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}

/** Focus first, as a click does in a browser and fireEvent doesn't. */
function ask() {
  const opener = screen.getByRole("button", { name: "Remove" });
  opener.focus();
  fireEvent.click(opener);
  return { opener, question: screen.getByRole("group", { name: "Remove this photo?" }) };
}

test("it is named by its question, and focus moves to Cancel", async () => {
  const { container } = render(<Harness />);
  const { question } = ask();

  expect(within(question).getByRole("button", { name: "Cancel" })).toHaveFocus();
  expect(question).toHaveTextContent("This can't be undone.");
  expect(await axe(container)).toHaveNoViolations();
});

test("Remove does the removing, and Cancel takes the question back, focus and all", () => {
  const onConfirm = jest.fn();
  render(<Harness onConfirm={onConfirm} />);
  const { opener, question } = ask();

  fireEvent.click(within(question).getByRole("button", { name: "Remove" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);

  fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test("Escape is Cancel, and stops there, so the modal around it stays open", () => {
  render(<Harness />);
  const { opener } = ask();

  // false: something called preventDefault, which the modal looks for.
  const notPrevented = fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

  expect(notPrevented).toBe(false);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test("while it is under way, it says so and ignores clicks, without dropping focus", () => {
  const onConfirm = jest.fn();
  render(<Harness busy onConfirm={onConfirm} />);
  const { question } = ask();
  const remove = within(question).getByRole("button", { name: "Removing..." });
  remove.focus();

  fireEvent.click(remove);
  fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(remove, { key: "Escape" });

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByRole("group")).toBeInTheDocument();
  // aria-disabled, not disabled: a disabled button would lose the focus.
  expect(remove).not.toBeDisabled();
  expect(remove).toHaveAttribute("aria-disabled", "true");
  expect(remove).toHaveFocus();
});
