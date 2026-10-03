import { authLink, returnPath } from "./returnTo";

/**
 * Back to the page you were on after logging in (#135), and never anywhere
 * but a page of this app.
 */

test.each([
  ["/single/2", "/single/2"],
  ["/search?q=bar%20%26%20grill&sort=rating#results", "/search?q=bar%20%26%20grill&sort=rating#results"],
  ["/", "/"],
])("a path inside the app, %s, is where it goes back to", (from, expected) => {
  expect(returnPath({ from })).toBe(expected);
});

test.each([
  ["no state at all", undefined],
  ["state without a from", {}],
  ["null state", null],
  ["a from that isn't text", { from: 42 }],
  ["a full address", { from: "https://elsewhere.example/phish" }],
  ["a protocol-relative one", { from: "//elsewhere.example" }],
  ["a backslash the browser reads as //", { from: "/\\elsewhere.example" }],
  ["a relative path", { from: "single/2" }],
  ["a script", { from: "javascript:alert(1)" }],
  ["the login page itself", { from: "/login" }],
  ["the signup page, with a query", { from: "/signup?next=/single/2" }],
])("%s goes home instead", (_, state) => {
  expect(returnPath(state)).toBe("/");
});

const here = (pathname: string, extra: any = {}) => ({ pathname, search: "", hash: "", ...extra });

test("a link from a page remembers it, query and hash and all", () => {
  expect(authLink("/login", here("/single/2", { search: "?tab=photos", hash: "#top" }))).toEqual({
    pathname: "/login", state: { from: "/single/2?tab=photos#top" },
  });
});

test("a link from the login page to signup passes on where login came from", () => {
  expect(authLink("/signup", here("/login", { state: { from: "/single/2" } }))).toEqual({
    pathname: "/signup", state: { from: "/single/2" },
  });
  // And never the login page itself, or anywhere it shouldn't.
  expect(authLink("/signup", here("/login"))).toEqual({ pathname: "/signup", state: { from: "/" } });
  expect(authLink("/login", here("/signup", { state: { from: "https://elsewhere.example" } })))
    .toEqual({ pathname: "/login", state: { from: "/" } });
});
