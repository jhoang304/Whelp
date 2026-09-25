import { render, screen } from "@testing-library/react";
import RatingStar from "./index";

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
