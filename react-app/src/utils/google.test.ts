import { GOOGLE_CONFIRM_URL, googleOutcome, googleSignInUrl } from "./google";

/** What the server's ?google= codes say, and where the links go. */

const FAILED = "Couldn't sign in with Google. Please try again.";

test("no code, nothing to say", () => {
  expect(googleOutcome("")).toEqual({ problem: null, success: null });
  expect(googleOutcome("?tab=photos")).toEqual({ problem: null, success: null });
});

test("each code the server sends says what happened", () => {
  expect(googleOutcome("?google=account-exists").problem).toMatch(/Log in with your password, then connect Google/);
  expect(googleOutcome("?google=cancelled").problem).toBe("Google sign-in was cancelled.");
  expect(googleOutcome("?google=wrong-account").problem).toMatch(/isn't the Google account connected/);
  expect(googleOutcome("?google=connected")).toEqual({
    problem: null, success: "Google is connected. You can log in with it from now on.",
  });
  expect(googleOutcome("?google=confirmed").success).toMatch(/confirmed for the next 10 minutes/);
});

test("a code it doesn't know is a failure, even one every object has", () => {
  for (const code of ["nonsense", "", "constructor", "toString", "__proto__", "hasOwnProperty"]) {
    expect(googleOutcome(`?google=${code}`)).toEqual({ problem: FAILED, success: null });
  }
});

test("the links go to the server, which goes to Google", () => {
  expect(googleSignInUrl("/single/2?tab=photos#reviews"))
    .toBe("/api/auth/google/start?next=%2Fsingle%2F2%3Ftab%3Dphotos%23reviews");
  expect(GOOGLE_CONFIRM_URL).toBe("/api/auth/google/start?intent=confirm");
});
