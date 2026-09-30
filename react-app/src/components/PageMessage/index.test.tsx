import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PageMessage from "./index";

/** A page with nothing but a message: the message is its heading (#122). */

test("the message is the page's h1", () => {
  render(
    <MemoryRouter>
      <PageMessage icon="fa-solid fa-store" title="We couldn't find that restaurant." action={{ to: "/restaurants", label: "Browse restaurants" }} />
    </MemoryRouter>
  );
  expect(screen.getByRole("heading", { level: 1, name: "We couldn't find that restaurant." })).toBeInTheDocument();
});

test("a second way on is a plain link beside the first", () => {
  render(
    <MemoryRouter>
      <PageMessage icon="fa-regular fa-compass" title="We couldn't find that page."
        action={{ to: "/restaurants", label: "Browse restaurants" }}
        secondaryAction={{ to: "/", label: "Go to the home page" }} />
    </MemoryRouter>
  );
  expect(screen.getByRole("link", { name: "Browse restaurants" })).toHaveClass("page-message-action");
  expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
});
