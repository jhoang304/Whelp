import { apiFetch, csrfToken } from "./api";

/**
 * A change sends the CSRF cookie back as X-CSRFToken, and nothing else does
 * (#109): the server refuses a POST, PUT, PATCH or DELETE without it.
 */

const setCookie = (value: string | null) => {
  // jsdom keeps cookies per document; an expired date removes one.
  document.cookie = value === null
    ? "csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    : `csrf_token=${value}`;
};

const sent = () => (global as any).fetch.mock.calls[0];

beforeEach(() => {
  (global as any).fetch = vi.fn(() => Promise.resolve({ ok: true }));
  setCookie("IjdiNGU.token-value_1");
});

afterEach(() => {
  delete (global as any).fetch;
  setCookie(null);
});

test("reads the token out of the cookie", () => {
  document.cookie = "other=1";
  expect(csrfToken()).toBe("IjdiNGU.token-value_1");
});

test.each(["POST", "PUT", "PATCH", "DELETE", "delete"])("a %s carries the token", async (method) => {
  await apiFetch("/api/restaurants/7/favorite", { method });
  expect(sent()[1].headers).toEqual({ "X-CSRFToken": "IjdiNGU.token-value_1" });
});

test("the headers a call already sets are kept", async () => {
  await apiFetch("/api/reviews/1", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  expect(sent()[1]).toEqual({
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-CSRFToken": "IjdiNGU.token-value_1" },
    body: "{}",
  });
});

test("a read sends no token", async () => {
  await apiFetch("/api/restaurants/7");
  expect(sent()).toEqual(["/api/restaurants/7"]);
});

test("the token never goes to another host", async () => {
  await apiFetch("https://example.com/collect", { method: "POST" });
  await apiFetch("//example.com/collect", { method: "POST" });
  (global as any).fetch.mock.calls.forEach(([, init]: [string, RequestInit]) => {
    expect(init.headers).toBeUndefined();
  });
});

test("before any response has set the cookie, the request goes as it is", async () => {
  setCookie(null);
  expect(csrfToken()).toBeNull();
  await apiFetch("/api/auth/login", { method: "POST" });
  expect(sent()[1]).toEqual({ method: "POST" });
});
