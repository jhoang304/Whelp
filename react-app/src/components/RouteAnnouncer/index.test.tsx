import { act, render } from "@testing-library/react";
import RouteAnnouncer from "./index";

/** Each new page's title, read out once it is the page's own (#130). */

beforeEach(() => {
  document.title = "Whelp";
});

/** Change the title, and let the observer and React both catch up. */
async function retitle(title: string) {
  await act(async () => {
    document.title = title;
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

test("a new title is read out, and the bare site name while a page loads is not", async () => {
  const { container } = render(<RouteAnnouncer />);
  const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
  expect(live).toBeEmptyDOMElement();

  await retitle("Restaurants · Whelp");
  expect(live).toHaveTextContent("Restaurants · Whelp");

  // A restaurant page shows "Whelp" while it loads, then its name: the
  // name is what is said, not "Whelp" first.
  await retitle("Whelp");
  expect(live).toHaveTextContent("Restaurants · Whelp");

  await retitle("Nancy's Hustle – Houston, TX · Whelp");
  expect(live).toHaveTextContent("Nancy's Hustle – Houston, TX · Whelp");
});
