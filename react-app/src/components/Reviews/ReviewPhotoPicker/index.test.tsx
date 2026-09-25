import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import ReviewPhotoPicker, { PendingPhoto } from "./index";
import { ReviewImage } from "../../../types";

/**
 * Choosing photos only stages them; the forms upload on submit. What the
 * picker owns is the staging: the ten-photo limit counted across photos the
 * review already has, files too large to send, and the blob: urls behind each
 * thumbnail, which leak if they are not revoked.
 */

beforeEach(() => {
  let n = 0;
  (global.URL as any).createObjectURL = jest.fn(() => `blob:preview-${n++}`);
  (global.URL as any).revokeObjectURL = jest.fn();
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

test("a photo the review already has is removed through the form's handler", () => {
  const onRemoveExisting = jest.fn();
  render(<Harness existing={[existingPhoto(7)]} onRemoveExisting={onRemoveExisting} />);

  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));

  expect(onRemoveExisting).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
});
