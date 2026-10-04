import { render } from "@testing-library/react";
import OpeningHoursTable from "./index";

/**
 * Today's row is the restaurant's today (#123): it was the reader's, so the
 * table and the open/closed badge beside it could be talking about different
 * days.
 */

const WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "11:00", closes: "23:00" }));
const today = () => document.querySelector("tr.today th")?.textContent;

// Monday 00:30 in Chicago, and still Sunday 22:30 in Los Angeles.
const MONDAY_IN_CHICAGO = new Date("2026-09-21T05:30:00Z");

afterEach(() => {
  vi.useRealTimers();
});

test("an LA restaurant's today is Sunday while it's already Monday in Chicago", () => {
  vi.useFakeTimers().setSystemTime(MONDAY_IN_CHICAGO);
  render(<OpeningHoursTable hours={WEEK} timezone="America/Los_Angeles" />);
  expect(today()).toBe("Sunday");
});

test("and a Chicago one's is Monday, at the same moment", () => {
  vi.useFakeTimers().setSystemTime(MONDAY_IN_CHICAGO);
  render(<OpeningHoursTable hours={WEEK} timezone="America/Chicago" />);
  expect(today()).toBe("Monday");
});
