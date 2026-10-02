import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReviewForm, { ReviewFormRestaurant, reviewProblems } from "./index";
import { MAX_REVIEW_LENGTH } from "../../../store/reviews";
import { DEFAULT_RESTAURANT_IMAGE } from "../../../utils/images";
import { axe } from "../../../testUtils/axe";

/**
 * The form both review pages share (#132): the restaurant it's about, stars
 * that start empty, room to write with a count, Cancel, and its own list of
 * what is missing in place of the browser's bubbles.
 */

const UCHI: ReviewFormRestaurant = { id: 3, name: "Uchi", city: "Houston", state: "TX", cover: "https://img/uchi.jpg" };

function Harness({
  restaurant = UCHI, initialReview = "", initialRating = null as number | null,
  onSubmit = jest.fn(), busy = false, submitDisabled = false,
}) {
  const [review, setReview] = useState(initialReview);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <MemoryRouter>
      <ReviewForm
        title={`Write a review for ${restaurant.name}`}
        restaurant={restaurant}
        review={review}
        onReviewChange={setReview}
        rating={rating}
        onRatingChange={setRating}
        errors={errors}
        onErrors={setErrors}
        onSubmit={onSubmit}
        submitLabel="Post review"
        busy={busy}
        busyLabel="Posting..."
        submitDisabled={submitDisabled}
      >
        <p>The photos</p>
      </ReviewForm>
    </MemoryRouter>
  );
}

const reviewBox = () => screen.getByRole("textbox", { name: "Your review" }) as HTMLTextAreaElement;
const post = () => fireEvent.click(screen.getByRole("button", { name: "Post review" }));

test("it says which restaurant: its photo, its name and its city", () => {
  render(<Harness />);

  expect(screen.getByRole("heading", { level: 1, name: "Write a review for Uchi" })).toBeInTheDocument();
  expect(screen.getByText("Houston, TX")).toBeInTheDocument();
  expect(document.querySelector(".review-form-cover")).toHaveAttribute("src", "https://img/uchi.jpg");
});

test("a restaurant with no photo shows the stand-in, and no city line when it has no city", () => {
  render(<Harness restaurant={{ id: 3, name: "Uchi" }} />);

  expect(document.querySelector(".review-form-cover")).toHaveAttribute("src", DEFAULT_RESTAURANT_IMAGE);
  expect(document.querySelector(".review-form-place")).toBeNull();
});

test("the review is a box to write in, with a count of what's left", () => {
  render(<Harness />);

  expect(reviewBox().tagName).toBe("TEXTAREA");
  expect(reviewBox()).toHaveAttribute("maxLength", String(MAX_REVIEW_LENGTH));
  expect(reviewBox()).toHaveAccessibleDescription("0/5,000");

  fireEvent.change(reviewBox(), { target: { value: "Great omakase." } });
  expect(screen.getByText("14/5,000")).not.toHaveClass("near-limit");

  // Red for the last tenth (#133): 25 characters' warning was for 255.
  fireEvent.change(reviewBox(), { target: { value: "x".repeat(4500) } });
  expect(screen.getByText("4,500/5,000")).not.toHaveClass("near-limit");
  fireEvent.change(reviewBox(), { target: { value: "x".repeat(4600) } });
  expect(screen.getByText("4,600/5,000")).toHaveClass("near-limit");
});

test("the browser's own required-field bubbles are off: the form says what's missing itself", () => {
  // jsdom doesn't show them, so this is the only place it can be seen.
  render(<Harness />);
  expect(reviewBox().closest("form")).toHaveAttribute("novalidate");
});

test("without a rating it says so, sends nothing, and puts focus on the first star", () => {
  const onSubmit = jest.fn();
  render(<Harness initialReview="Great omakase." onSubmit={onSubmit} />);

  post();

  expect(screen.getByRole("alert")).toHaveTextContent("Choose a rating, from one to five stars.");
  expect(screen.getByRole("radio", { name: /^1 star,/ })).toHaveFocus();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("without any words it says so, and puts focus in the box", () => {
  const onSubmit = jest.fn();
  render(<Harness initialReview="   " initialRating={4} onSubmit={onSubmit} />);

  post();

  expect(screen.getByRole("alert")).toHaveTextContent("Write your review.");
  expect(screen.getByRole("alert")).not.toHaveTextContent("rating");
  expect(reviewBox()).toHaveFocus();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("with both, it sends the review trimmed and the stars, and clears what it said before", () => {
  const onSubmit = jest.fn();
  render(<Harness onSubmit={onSubmit} />);
  post();
  expect(screen.getByRole("alert")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /^4 stars/ }));
  fireEvent.change(reviewBox(), { target: { value: "  Great omakase.  " } });
  post();

  expect(onSubmit).toHaveBeenCalledWith("Great omakase.", 4);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("Cancel goes back to the restaurant", () => {
  render(<Harness />);
  expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/single/3");
});

test("while it sends, or while something else holds it back, the button waits", () => {
  const { unmount } = render(<Harness busy />);
  expect(screen.getByRole("button", { name: "Posting..." })).toBeDisabled();
  unmount();

  render(<Harness submitDisabled />);
  expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
});

test("the photos go inside the form", () => {
  render(<Harness />);
  expect(screen.getByText("The photos").closest("form")).not.toBeNull();
});

test("with its errors showing, nothing on it fails an accessibility check", async () => {
  const { container } = render(<Harness />);
  post();
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

test("a review over the limit is refused, with the limit in the message", () => {
  expect(MAX_REVIEW_LENGTH).toBe(5000);
  expect(reviewProblems("x".repeat(MAX_REVIEW_LENGTH + 1), 3)).toEqual(["Reviews must be 5,000 characters or fewer."]);
  expect(reviewProblems("x".repeat(MAX_REVIEW_LENGTH), 3)).toEqual([]);
});

test("a review well past the old 255 goes through", () => {
  const onSubmit = jest.fn();
  const long = "Every course was better than the last. ".repeat(20).trim();
  render(<Harness initialReview={long} initialRating={5} onSubmit={onSubmit} />);

  post();

  expect(long.length).toBeGreaterThan(255);
  expect(onSubmit).toHaveBeenCalledWith(long, 5);
});
