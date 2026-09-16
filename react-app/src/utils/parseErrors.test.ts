import { parseErrors } from "./parseErrors";

const response = (body: any, ok = false): Response => ({
  ok,
  json: async () => {
    if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
    return body;
  },
} as Response);

test("returns the API's messages", async () => {
  const errors = await parseErrors(
    response({ errors: ["City is required.", "Website is required."] }), "fallback");
  expect(errors).toEqual(["City is required.", "Website is required."]);
});

test("falls back when the body has no errors", async () => {
  expect(await parseErrors(response({ id: 7 }), "fallback")).toEqual(["fallback"]);
});

test("falls back when the errors list is empty", async () => {
  expect(await parseErrors(response({ errors: [] }), "fallback")).toEqual(["fallback"]);
});

test("falls back when the body is not JSON at all", async () => {
  expect(await parseErrors(response(undefined), "fallback")).toEqual(["fallback"]);
});

test("falls back on the shapes the API no longer sends", async () => {
  expect(await parseErrors(response({ errors: { city: ["required"] } }), "fallback"))
    .toEqual(["fallback"]);
  expect(await parseErrors(response({ errors: "City is required." }), "fallback"))
    .toEqual(["fallback"]);
});
