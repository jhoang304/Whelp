import { render, screen } from "@testing-library/react";
import Footer from "./index";

/** Icon-only links, so their names have to be given to them. */

test("both icon links have a name a screen reader can say", () => {
  render(<Footer />);
  expect(screen.getByRole("link", { name: /on GitHub/ })).toHaveAttribute("href", "https://github.com/jhoang304");
  expect(screen.getByRole("link", { name: /on LinkedIn/ })).toBeInTheDocument();
});
