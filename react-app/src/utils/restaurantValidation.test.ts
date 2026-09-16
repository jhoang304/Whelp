import {
  MAX_DESCRIPTION_LENGTH,
  MAX_WEBSITE_LENGTH,
  validateRestaurant,
  RestaurantFields,
} from "./restaurantValidation";

/** A set of fields that passes; override one at a time per test. */
const fields = (overrides: Partial<RestaurantFields> = {}): RestaurantFields => ({
  name: "Test Bistro",
  price: "$$",
  address: "1 Main St",
  city: "Houston",
  state: "TX",
  zipcode: "77001",
  country: "USA",
  phone_number: "(555) 555-5555",
  website: "http://testbistro.com",
  description: "A place for tests.",
  ...overrides,
});

test("a fully valid restaurant has no errors", () => {
  expect(validateRestaurant(fields())).toEqual([]);
});

describe("website", () => {
  // Regression: the edit modal required a trailing .com, so the owners of
  // these businesses could not edit any field without changing their website.
  it.each([
    "https://runchickenrun.com/las-vegas/",
    "https://auchevaldiner.com/chicago/",
    "https://example.org",
    "https://example.net",
    "https://example.co",
    "example.com",
  ])("accepts %s", (website) => {
    expect(validateRestaurant(fields({ website }))).toEqual([]);
  });

  it("still rejects something with no dot at all", () => {
    expect(validateRestaurant(fields({ website: "notaurl" }))).toContain(
      "Please enter a valid website URL (e.g., example.com)"
    );
  });

  it("rejects a website over the column limit", () => {
    const website = `http://${"x".repeat(MAX_WEBSITE_LENGTH)}.com`;
    expect(validateRestaurant(fields({ website }))).toContain(
      `Website must be ${MAX_WEBSITE_LENGTH} characters or less`
    );
  });
});

describe("phone number", () => {
  // Regression: an allowlist of digits/spaces/hyphens/parentheses blocked
  // every international number, while the server imposes no format at all.
  it.each([
    "+1 555 123 4567",
    "(555) 555-5555",
    "555.123.4567",
    "555-1234 x99",
  ])("accepts %s", (phone_number) => {
    expect(validateRestaurant(fields({ phone_number }))).toEqual([]);
  });

  it("rejects a phone number with no digits", () => {
    expect(validateRestaurant(fields({ phone_number: "call me" }))).toContain(
      "Phone number must include at least one digit"
    );
  });
});

describe("required fields and limits", () => {
  it("reports each empty field", () => {
    const errors = validateRestaurant(fields({ name: "  ", city: "", website: "" }));
    expect(errors).toContain("Restaurant name is required");
    expect(errors).toContain("City is required");
    expect(errors).toContain("Website is required");
  });

  it("rejects a state that is not two characters", () => {
    expect(validateRestaurant(fields({ state: "Texas" }))).toContain(
      "State must be exactly 2 characters (e.g., CA, NY)"
    );
  });

  it("rejects a description over the column limit", () => {
    const description = "d".repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(validateRestaurant(fields({ description }))).toContain(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
    );
  });

  it("accepts a description exactly at the limit", () => {
    const description = "d".repeat(MAX_DESCRIPTION_LENGTH);
    expect(validateRestaurant(fields({ description }))).toEqual([]);
  });

  it("rejects a malformed postcode", () => {
    expect(validateRestaurant(fields({ zipcode: "!!!" })).length).toBeGreaterThan(0);
  });
});
