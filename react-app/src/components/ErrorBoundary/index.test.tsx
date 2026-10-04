import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ErrorBoundary from "./index";
import type { MockInstance } from "vitest";

/**
 * A page that throws while rendering shows "Something went wrong" instead
 * of taking the whole app with it, and the nav bar outside it stays (#116).
 */

function Broken(): React.JSX.Element {
  throw new Error("a value the page could not draw");
}

/** A nav outside the boundary, and a page inside it that breaks until moved on from. */
function Shell() {
  const [where, setWhere] = useState("/broken");
  return (
    <MemoryRouter>
      <nav>
        <button type="button" onClick={() => setWhere("/fine")}>Somewhere else</button>
      </nav>
      <ErrorBoundary resetKey={where}>
        {where === "/broken" ? <Broken /> : <p>A page that works</p>}
      </ErrorBoundary>
    </MemoryRouter>
  );
}

let consoleError: MockInstance;
beforeEach(() => {
  // React and the boundary both report the error; the test expects it.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

test("a page that throws shows a message, and the nav outside it is still there", () => {
  render(<Shell />);

  expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reload the page" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Somewhere else" })).toBeInTheDocument();
  expect(consoleError).toHaveBeenCalledWith("A page failed to render:", expect.any(Error), expect.anything());
});

test("going somewhere else draws that page", () => {
  render(<Shell />);

  fireEvent.click(screen.getByRole("button", { name: "Somewhere else" }));

  expect(screen.getByText("A page that works")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();
});

test("a page that doesn't throw is drawn as it is", () => {
  render(
    <MemoryRouter>
      <ErrorBoundary resetKey="/">
        <p>Fine</p>
      </ErrorBoundary>
    </MemoryRouter>
  );

  expect(screen.getByText("Fine")).toBeInTheDocument();
});
