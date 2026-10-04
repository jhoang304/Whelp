import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StarPicker from "./index";
import { axe } from "../../../testUtils/axe";

/**
 * The rating, as stars (#132). It starts empty -- the select it replaces
 * started at 3 -- and it is five radio buttons under one name, so the
 * browser gives it the arrow keys and a screen reader counts "3 of 5".
 */

function Harness({ initial = null as number | null, onChange = (_: number) => {} }) {
  const [value, setValue] = useState<number | null>(initial);
  return <StarPicker value={value} onChange={(rating) => { setValue(rating); onChange(rating); }} />;
}

const stars = () => screen.getAllByRole("radio") as HTMLInputElement[];
const filled = () => document.querySelectorAll(".star-picker-star.filled").length;
const meaning = () => document.querySelector(".star-picker-meaning")!.textContent;

test("five stars in one group, named, required, and none chosen to begin with", async () => {
  const { container } = render(<Harness />);

  expect(screen.getByRole("group", { name: "Your rating" })).toBeInTheDocument();
  expect(stars().map((star) => star.getAttribute("aria-label"))).toEqual([
    "1 star, Not good", "2 stars, Could've been better", "3 stars, OK", "4 stars, Good", "5 stars, Great",
  ]);
  // One name: the browser moves between them with the arrow keys.
  expect(new Set(stars().map((star) => star.name)).size).toBe(1);
  expect(stars().every((star) => star.required)).toBe(true);
  expect(stars().some((star) => star.checked)).toBe(false);
  expect(filled()).toBe(0);
  expect(meaning()).toBe("Select your rating");
  expect(await axe(container)).toHaveNoViolations();
});

test("choosing a star fills it and the ones before it, and says what it means", () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);

  fireEvent.click(screen.getByRole("radio", { name: "3 stars, OK" }));

  expect(onChange).toHaveBeenCalledWith(3);
  expect(screen.getByRole("radio", { name: "3 stars, OK" })).toBeChecked();
  expect(filled()).toBe(3);
  expect(meaning()).toBe("OK");
});

test("pointing at a star shows what it would give, and leaving shows the choice again", () => {
  render(<Harness initial={2} />);
  const labels = document.querySelectorAll(".star-picker-star");

  fireEvent.mouseEnter(labels[4]);
  expect(filled()).toBe(5);
  expect(meaning()).toBe("Great");

  fireEvent.mouseLeave(document.querySelector(".star-picker-stars")!);
  expect(filled()).toBe(2);
  expect(meaning()).toBe("Could've been better");
  expect(screen.getByRole("radio", { name: /^2 stars/ })).toBeChecked();
});
