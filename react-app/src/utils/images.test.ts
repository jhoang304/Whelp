import { imageUrlProblem, MAX_IMAGE_URL_LENGTH } from "./images";

/** The rules a pasted photo link is held to, the API's own (#111, #114). */

test("an http or https link of any case is taken", () => {
  expect(imageUrlProblem("https://example.com/a.jpg", "Photo URL")).toBeNull();
  expect(imageUrlProblem("http://example.com/a.jpg", "Photo URL")).toBeNull();
  expect(imageUrlProblem("HTTPS://Example.com/a.jpg", "Photo URL")).toBeNull();
});

test("anything else says what it must start with, naming the field", () => {
  expect(imageUrlProblem("ftp://example.com/a.jpg", "Photo URL")).toBe("Photo URL must start with http:// or https://");
  expect(imageUrlProblem("javascript:alert(1)", "Image URL")).toBe("Image URL must start with http:// or https://");
});

test("a link longer than the column is refused, and one at the limit is not", () => {
  const at = (length: number) => "https://e.com/" + "a".repeat(length - "https://e.com/".length);
  expect(at(MAX_IMAGE_URL_LENGTH)).toHaveLength(255);
  expect(imageUrlProblem(at(255), "Photo URL")).toBeNull();
  expect(imageUrlProblem(at(256), "Photo URL")).toBe("Photo URL must be 255 characters or fewer.");
});
