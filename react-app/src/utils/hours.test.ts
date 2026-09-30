import { describeOpenStatus, formatTime, runsPastMidnight, validateHours, weekdayIn } from "./hours";

describe("reading a time", () => {
  it.each([
    ["09:00", "9:00 AM"],
    ["11:30", "11:30 AM"],
    ["13:05", "1:05 PM"],
    ["22:00", "10:00 PM"],
  ])("shows %s as %s", (given, expected) => {
    expect(formatTime(given)).toBe(expected);
  });

  it("calls midnight and noon twelve, not zero", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
  });

  it("hands back anything it cannot read", () => {
    // Better a raw value on screen than "NaN:undefined AM".
    expect(formatTime("later")).toBe("later");
    expect(formatTime("25:00")).toBe("25:00");
    expect(formatTime("")).toBe("");
  });
});

describe("the line a card shows", () => {
  it("says nothing at all when nobody has said", () => {
    // Not "Closed": the API sends null when a restaurant has no hours, and
    // showing it as shut would invent a fact.
    expect(describeOpenStatus(null)).toBeNull();
  });

  it("says when an open restaurant closes", () => {
    expect(describeOpenStatus({ isOpen: true, until: "22:00" })).toEqual({
      isOpen: true,
      text: "until 10:00 PM",
    });
  });

  it("says when a closed one opens again", () => {
    expect(describeOpenStatus({
      isOpen: false, opensAt: "11:00", opensDay: "Tuesday", opensWeekday: 1,
    })).toEqual({ isOpen: false, text: "Opens 11:00 AM Tuesday" });
  });

  it("copes with a closed restaurant that never opens again", () => {
    expect(describeOpenStatus({ isOpen: false })).toEqual({ isOpen: false, text: "" });
  });

  // "Opens 5:00 PM Saturday", said on a Saturday, read as a week away (#123).
  const closed = (opensInDays: number) => describeOpenStatus({
    isOpen: false, opensAt: "17:00", opensDay: "Saturday", opensWeekday: 5, opensInDays,
  })!.text;

  it("says nothing more for later today", () => {
    expect(closed(0)).toBe("Opens 5:00 PM");
  });

  it("says tomorrow for tomorrow", () => {
    expect(closed(1)).toBe("Opens 5:00 PM tomorrow");
  });

  it("names the day for later in the week", () => {
    expect(closed(3)).toBe("Opens 5:00 PM Saturday");
  });

  it("says next Saturday on a Saturday it has already closed", () => {
    expect(closed(7)).toBe("Opens 5:00 PM next Saturday");
  });
});

describe("today, where the restaurant is (#123)", () => {
  // Monday 00:30 in Chicago, and still Sunday 22:30 in Los Angeles.
  const now = new Date("2026-09-21T05:30:00Z");

  it("is the restaurant's weekday, not the reader's", () => {
    expect(weekdayIn("America/Chicago", now)).toBe(0);
    expect(weekdayIn("America/Los_Angeles", now)).toBe(6);
  });

  it("is the reader's when there is no zone, or one nobody knows", () => {
    const readers = (now.getDay() + 6) % 7;
    expect(weekdayIn(null, now)).toBe(readers);
    expect(weekdayIn("Mars/Olympus", now)).toBe(readers);
  });
});

describe("a night that runs past midnight", () => {
  it("is one where closing is not after opening", () => {
    expect(runsPastMidnight({ weekday: 0, opens: "17:00", closes: "02:00" })).toBe(true);
    expect(runsPastMidnight({ weekday: 0, opens: "08:00", closes: "00:00" })).toBe(true);
    expect(runsPastMidnight({ weekday: 0, opens: "11:00", closes: "22:00" })).toBe(false);
  });
});

describe("checking the week before saving it", () => {
  it("passes a week that is filled in", () => {
    expect(validateHours([
      { weekday: 0, opens: "11:00", closes: "22:00" },
      { weekday: 5, opens: "17:00", closes: "02:00" },
    ])).toEqual([]);
  });

  it("passes a week with no days at all", () => {
    expect(validateHours([])).toEqual([]);
  });

  it("catches a day left half filled in", () => {
    expect(validateHours([{ weekday: 2, opens: "11:00", closes: "" }])).toEqual([
      "Wednesday needs an opening and a closing time, or mark it closed",
    ]);
  });

  it("catches the same day twice", () => {
    expect(validateHours([
      { weekday: 1, opens: "11:00", closes: "15:00" },
      { weekday: 1, opens: "17:00", closes: "22:00" },
    ])).toEqual(["Tuesday is listed twice"]);
  });
});
