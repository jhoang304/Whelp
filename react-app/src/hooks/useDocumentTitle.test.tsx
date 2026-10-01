import { render } from "@testing-library/react";
import { pageTitle, useDocumentTitle } from "./useDocumentTitle";

/** A page's title while it is up, and the one before it back after (#130). */

function Page({ title }: { title: string | null }) {
  useDocumentTitle(title);
  return null;
}

beforeEach(() => {
  document.title = "Whelp";
});

test("a page names the tab, and gives the old name back when it goes", () => {
  const { rerender, unmount } = render(<Page title={pageTitle("Restaurants")} />);
  expect(document.title).toBe("Restaurants · Whelp");

  rerender(<Page title={pageTitle("Italian restaurants")} />);
  expect(document.title).toBe("Italian restaurants · Whelp");

  unmount();
  expect(document.title).toBe("Whelp");
});

test("null leaves whatever is there alone", () => {
  document.title = "Set by someone else · Whelp";
  const { unmount } = render(<Page title={null} />);
  expect(document.title).toBe("Set by someone else · Whelp");
  unmount();
  expect(document.title).toBe("Set by someone else · Whelp");
});

test("a child's title stands when its page says null", () => {
  // Effects run child first: a page setting its own would overwrite this.
  function Parent({ title }: { title: string | null }) {
    useDocumentTitle(title);
    return <Page title={pageTitle("Log in to write a review")} />;
  }
  render(<Parent title={null} />);
  expect(document.title).toBe("Log in to write a review · Whelp");
});
