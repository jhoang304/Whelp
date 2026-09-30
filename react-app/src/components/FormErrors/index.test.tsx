import { render, screen, within } from "@testing-library/react";
import FormErrors from "./index";
import { axe } from "../../testUtils/axe";

/** A form's errors are announced, and are still a list (#122). */

test("the errors are an alert, around a list of them", async () => {
  const { container } = render(<FormErrors errors={["Name is required.", "City is required."]} id="errs" className="x" />);

  const alert = screen.getByRole("alert");
  expect(alert).toHaveAttribute("id", "errs");
  const list = within(alert).getByRole("list");
  expect(list).toHaveClass("x");
  expect(within(list).getAllByRole("listitem").map((item) => item.textContent))
    .toEqual(["Name is required.", "City is required."]);
  expect(await axe(container)).toHaveNoViolations();
});

test("with none, there is nothing, and nothing to announce", () => {
  const { container } = render(<FormErrors errors={[]} />);
  expect(container).toBeEmptyDOMElement();
});
