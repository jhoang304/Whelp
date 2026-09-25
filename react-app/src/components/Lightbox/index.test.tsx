import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import Lightbox, { LightboxPhoto } from "./index";

/**
 * The viewer the restaurant photo modal and review photos share. It was lifted
 * out of the modal, so these pin what the modal's copy did -- stepping, and
 * wrapping at either end -- and what it did not: Escape and the arrow keys.
 */

const PHOTOS: LightboxPhoto[] = [
  { url: "https://example.com/1.jpg", alt: "First" },
  { url: "https://example.com/2.jpg", alt: "Second" },
  { url: "https://example.com/3.jpg", alt: "Third" },
];

function Harness({ photos = PHOTOS, start = 0, onClose = () => {} }) {
  const [index, setIndex] = useState(start);
  return <Lightbox photos={photos} index={index} onIndexChange={setIndex} onClose={onClose} />;
}

const shown = () => screen.getByRole("dialog").querySelector("img.image-viewer-photo")!.getAttribute("alt");

test("shows the photo it was opened on, and how far along it is", () => {
  render(<Harness start={1} />);
  expect(shown()).toBe("Second");
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
});

test("steps forward and back, wrapping at either end", () => {
  render(<Harness start={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
  expect(shown()).toBe("First");
  fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
  expect(shown()).toBe("Third");
});

test("the arrow keys step too", () => {
  render(<Harness />);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(shown()).toBe("Second");
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  expect(shown()).toBe("Third");
});

test("Escape closes it, and so does the close button", () => {
  const onClose = jest.fn();
  render(<Harness onClose={onClose} />);
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Close image viewer" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("clicking the photo itself does not close it", () => {
  const onClose = jest.fn();
  render(<Harness onClose={onClose} />);
  fireEvent.click(screen.getByAltText("First"));
  expect(onClose).not.toHaveBeenCalled();
});

test("one photo has nowhere to step to, so no arrows", () => {
  render(<Harness photos={[PHOTOS[0]]} />);
  expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(shown()).toBe("First");
});
