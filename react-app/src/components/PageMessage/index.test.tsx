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
