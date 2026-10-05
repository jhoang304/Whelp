import { act, render, screen } from "@testing-library/react";
import GoogleButton from "./index";
import { axe } from "../../testUtils/axe";

/**
 * "Continue with Google" is a link to the server, drawn only once the server
 * says it can sign people in with Google -- a site with no client set up
 * shows no button that would only fail.
 */

const answer = (status: number, body: unknown) => {
  (global as any).fetch = vi.fn(() => Promise.resolve({
    ok: status < 400, status, json: () => Promise.resolve(body),
  }));
};

afterEach(() => {
  delete (global as any).fetch;
});

test("once the server offers Google, it links there and back to the page", async () => {
  answer(200, { available: true, confirmed: false });
  const { container } = render(<GoogleButton next="/single/2?tab=photos" />);

  const link = await screen.findByRole("link", { name: "Continue with Google" });
  expect(link).toHaveAttribute("href", "/api/auth/google/start?next=%2Fsingle%2F2%3Ftab%3Dphotos");
  expect((global as any).fetch).toHaveBeenCalledWith("/api/auth/google");
  expect(await axe(container)).toHaveNoViolations();
});

test.each([
  ["Google isn't set up", () => answer(200, { available: false, confirmed: false })],
  ["the answer is an error", () => answer(500, { errors: ["Internal Server Error"] })],
  ["the answer is nonsense", () => answer(200, null)],
  ["the server can't be reached", () => {
    (global as any).fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  }],
])("nothing is drawn when %s", async (_why, arrange) => {
  arrange();
  const { container } = render(<GoogleButton next="/" />);
  await act(async () => {
    await Promise.resolve();
  });
  expect((global as any).fetch).toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});
