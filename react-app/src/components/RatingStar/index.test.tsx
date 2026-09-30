import { render, screen } from "@testing-library/react";
import RatingStar, { STAR_FILL } from "./index";

/** Five drawings to the eye, one named image to a screen reader. */

test("the stars are read as the rating they show", () => {
  render(<RatingStar rating={4.5} />);
  expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
});

test("an average is read to one decimal", () => {
  render(<RatingStar rating={4.333333} />);
  expect(screen.getByRole("img", { name: "4.3 out of 5 stars" })).toBeInTheDocument();
});

test("no average at all draws five empty stars instead of throwing", () => {
  const { container } = render(<RatingStar rating={NaN} />);
  expect(screen.getByRole("img", { name: "0 out of 5 stars" })).toBeInTheDocument();
  expect(container.querySelectorAll("svg")).toHaveLength(5);
});

// --- drawn to the nearest half (#123) --------------------------------------------------

/** How many stars are drawn: a whole one is filled on both sides, a half on its left. */
function drawn(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("svg")).reduce((total, star) => {
    const [left, right] = Array.from(star.querySelectorAll("path")).map((path) => path.getAttribute("fill"));
    if (left !== STAR_FILL) return total;
    return total + (right === STAR_FILL ? 1 : 0.5);
  }, 0);
}

test.each([
  [4.1, 4], [4.24, 4], [4.25, 4.5], [4.5, 4.5], [4.74, 4.5], [4.75, 5], [4.9, 5],
  [3.75, 4], [0.2, 0], [0.3, 0.5],
])("%s draws as %s stars", (rating, stars) => {
  // It drew a half for any fraction at all: 4.1 and 4.9 both looked like 4.5.
  const { container } = render(<RatingStar rating={rating} />);
  expect(drawn(container)).toBe(stars);
  expect(container.querySelectorAll("svg")).toHaveLength(5);
});

test("the label keeps the average, not the rounded drawing", () => {
  render(<RatingStar rating={3.75} />);
  expect(screen.getByRole("img", { name: "3.8 out of 5 stars" })).toBeInTheDocument();
});
