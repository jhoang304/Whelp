import { render, screen, fireEvent } from "@testing-library/react";
import ReviewPhotos from "./index";
import { ReviewImage } from "../../../types";

const photo = (id: number): ReviewImage => ({
  id,
  review_id: 1,
  url: `https://example.com/${id}.jpg`,
  createdAt: "",
  updatedAt: "",
});

test("a review without photos draws nothing, not an empty strip", () => {
  const { container } = render(<ReviewPhotos photos={[]} author="rita" />);
  expect(container).toBeEmptyDOMElement();
});

test("each photo is a button a keyboard can reach, named for whose review it is", () => {
  render(<ReviewPhotos photos={[photo(1), photo(2)]} author="rita" />);
  expect(screen.getByRole("button", { name: "Enlarge photo 1 of 2 from rita's review" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enlarge photo 2 of 2 from rita's review" })).toBeInTheDocument();
});

test("clicking one opens the viewer on that photo", () => {
  render(<ReviewPhotos photos={[photo(1), photo(2), photo(3)]} author="rita" />);

  fireEvent.click(screen.getByRole("button", { name: /photo 2 of 3/ }));

  const viewer = screen.getByRole("dialog");
  expect(viewer.querySelector("img.image-viewer-photo")).toHaveAttribute("src", "https://example.com/2.jpg");
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
});
