import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import ReviewPhotoPicker, { PendingPhoto } from "./index";
import { ReviewImage } from "../../../types";

/**
 * Choosing photos only stages them; the forms upload on submit. What the
 * picker owns is the staging: the ten-photo limit counted across photos the
 * review already has, files too large to send, and the blob: urls behind each
 * thumbnail, which leak if they are not revoked. And the × on a photo the
 * review already has, which deletes it there and then, asks first (#131).
 */

beforeEach(() => {
  let n = 0;
  (global.URL as any).createObjectURL = vi.fn(() => `blob:preview-${n++}`);
  (global.URL as any).revokeObjectURL = vi.fn();
});

const file = (name: string, bytes = 10) => new File(["x".repeat(bytes)], name, { type: "image/png" });

const existingPhoto = (id: number): ReviewImage => ({
  id, review_id: 1, url: `https://example.com/${id}.jpg`, createdAt: "", updatedAt: "",
});

function Harness({ existing = [] as ReviewImage[], onRemoveExisting = undefined as any }) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  return (
    <ReviewPhotoPicker
      pending={pending}
      onPendingChange={setPending}
      existing={existing}
      onRemoveExisting={onRemoveExisting}
    />
  );
}

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const choose = (...files: File[]) => fireEvent.change(input(), { target: { files } });

test("chosen photos are staged, with a thumbnail each", () => {
  render(<Harness />);

  choose(file("a.png"), file("b.png"));

  expect(screen.getByAltText("a.png, not yet uploaded")).toHaveAttribute("src", "blob:preview-0");
  expect(screen.getByAltText("b.png, not yet uploaded")).toBeInTheDocument();
  expect(screen.getByText("2 of 10")).toBeInTheDocument();
});

test("the limit of ten counts photos the review already has", () => {
  const eight = Array.from({ length: 8 }, (_, i) => existingPhoto(i + 1));
  render(<Harness existing={eight} />);

  choose(file("a.png"), file("b.png"), file("c.png"));

  expect(screen.getByText("10 of 10")).toBeInTheDocument();
  expect(screen.queryByAltText("c.png, not yet uploaded")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("A review can have 10 photos, so 1 was left out.");
  // full: nothing more can be chosen
  expect(input()).toBeNull();
});

test("a file too large to upload is refused when chosen, not after submitting", () => {
  render(<Harness />);

  choose(file("huge.png", 6 * 1024 * 1024), file("fine.png"));

  expect(screen.getByRole("status")).toHaveTextContent("huge.png is over 5 MB.");
  expect(screen.queryByAltText("huge.png, not yet uploaded")).not.toBeInTheDocument();
  expect(screen.getByAltText("fine.png, not yet uploaded")).toBeInTheDocument();
});

test("dropping a staged photo takes it out and lets its blob url go", () => {
  render(<Harness />);
  choose(file("a.png"));

  fireEvent.click(screen.getByRole("button", { name: "Don't add a.png" }));

  expect(screen.queryByAltText("a.png, not yet uploaded")).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
});

test("leaving the page lets every staged photo's blob url go", () => {
  const { unmount } = render(<Harness />);
  choose(file("a.png"), file("b.png"));

  unmount();

  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
});

/** Photo 1's ×, clicked with focus on it, as in a browser. */
function askAboutFirst() {
  const remove = screen.getByRole("button", { name: "Remove photo 1" });
  remove.focus();
  fireEvent.click(remove);
  return { remove, question: screen.getByRole("group", { name: "Remove photo 1?" }) };
}

test("the × on a photo the review already has asks first, and Remove goes through the form's handler", async () => {
  const onRemoveExisting = vi.fn(() => Promise.resolve(true));
  render(<Harness existing={[existingPhoto(7)]} onRemoveExisting={onRemoveExisting} />);
  const { remove, question } = askAboutFirst();

  expect(onRemoveExisting).not.toHaveBeenCalled();
  expect(question).toHaveTextContent("It comes off your review right away, not when you submit.");
  expect(within(question).getByRole("button", { name: "Cancel" })).toHaveFocus();
  expect(remove).toHaveAttribute("aria-expanded", "true");
  expect(remove.closest(".review-photo-picker-item")).toHaveClass("confirming");

  fireEvent.click(within(question).getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(onRemoveExisting).toHaveBeenCalledWith(expect.objectContaining({ id: 7 })));
});

test("Cancel leaves the photo, calls nothing, and gives focus back to its ×", () => {
  const onRemoveExisting = vi.fn(() => Promise.resolve(true));
  render(<Harness existing={[existingPhoto(7)]} onRemoveExisting={onRemoveExisting} />);
  const { remove, question } = askAboutFirst();

  fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(remove).toHaveFocus();
  expect(remove.closest(".review-photo-picker-item")).not.toHaveClass("confirming");
  expect(onRemoveExisting).not.toHaveBeenCalled();
});

test("a staged photo's × doesn't ask: nothing is lost, the file is still where it was", () => {
  render(<Harness />);
  choose(file("a.png"));

  fireEvent.click(screen.getByRole("button", { name: "Don't add a.png" }));

  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(screen.queryByAltText("a.png, not yet uploaded")).not.toBeInTheDocument();
});

/** The edit form's part: the review's photos, less those it has removed. */
function Editing({ photos, removes = true }: { photos: ReviewImage[]; removes?: boolean }) {
  const [existing, setExisting] = useState(photos);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const onRemoveExisting = async (image: ReviewImage) => {
    if (removes) setExisting((all) => all.filter((kept) => kept.id !== image.id));
    return removes;
  };
  return <ReviewPhotoPicker pending={pending} onPendingChange={setPending} existing={existing} onRemoveExisting={onRemoveExisting} />;
}

test("once a photo is removed, focus goes on to the next one, and with none left to Add photos", async () => {
  render(<Editing photos={[existingPhoto(7), existingPhoto(8)]} />);

  fireEvent.click(within(askAboutFirst().question).getByRole("button", { name: "Remove" }));

  // Photo 8, now the first.
  await waitFor(() => expect(screen.getByRole("button", { name: "Remove photo 1" })).toHaveFocus());
  expect(screen.getByAltText("Already on this review, 1 of 1")).toHaveAttribute("src", "https://example.com/8.jpg");
  expect(screen.getByRole("status")).toHaveTextContent("Photo removed.");

  fireEvent.click(within(askAboutFirst().question).getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(input()).toHaveFocus());
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("a removal that didn't go through leaves the question up, to try again", async () => {
  render(<Editing photos={[existingPhoto(7)]} removes={false} />);
  const { question } = askAboutFirst();
  const remove = within(question).getByRole("button", { name: "Remove" });
  remove.focus();

  fireEvent.click(remove);

  await waitFor(() => expect(screen.getByRole("group", { name: "Remove photo 1?" })).toBeInTheDocument());
  expect(screen.getByAltText("Already on this review, 1 of 1")).toBeInTheDocument();
  expect(remove).toHaveFocus();
});
