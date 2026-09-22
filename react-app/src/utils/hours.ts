import { OpeningHours, OpenStatus } from "../types";

/**
 * Reading and writing opening hours.
 *
 * Times travel as "HH:MM" in both directions, which is what `<input
 * type="time">` produces and what the API takes, so nothing has to be parsed
 * on the way through. They are only turned into "10:00 PM" to be read.
 */

/** 0 is Monday, matching the API and Python's date.weekday(). */
export const WEEKDAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const SHORT_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DEFAULT_OPENS = "09:00";
export const DEFAULT_CLOSES = "17:00";

/** "22:00" as "10:00 PM". Anything unparseable comes back as it went in. */
export function formatTime(value: string): string {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
    if (!match) return value;

    const hours = Number(match[1]);
    const minutes = match[2];
    if (hours > 23 || Number(minutes) > 59) return value;

    const suffix = hours < 12 ? "AM" : "PM";
    // Midnight and noon are 12, not 0.
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${minutes} ${suffix}`;
}

/** The one line a card or a detail page shows, or null to show nothing. */
export function describeOpenStatus(status: OpenStatus): { isOpen: boolean; text: string } | null {
    if (!status) return null;

    if (status.isOpen) {
        return { isOpen: true, text: `until ${formatTime(status.until)}` };
    }

    if (status.opensAt && status.opensDay) {
        return { isOpen: false, text: `Opens ${formatTime(status.opensAt)} ${status.opensDay}` };
    }
    return { isOpen: false, text: "" };
}

/** The hours sorted for display, Monday first. */
export function byWeekday(hours: OpeningHours[]): OpeningHours[] {
    return [...hours].sort((left, right) => left.weekday - right.weekday);
}

/** A day whose closing time is at or before its opening runs past midnight. */
export function runsPastMidnight(day: OpeningHours): boolean {
    return day.closes <= day.opens;
}

/**
 * What is wrong with the week, as messages ready to show.
 *
 * `<input type="time">` cannot produce a malformed time, but it can produce an
 * empty one, and a day marked open with no times is the mistake worth catching
 * before the save rather than after it.
 */
export function validateHours(hours: OpeningHours[]): string[] {
    const errors: string[] = [];
    const seen = new Set<number>();

    for (const day of byWeekday(hours)) {
        const name = WEEKDAYS[day.weekday] ?? `Day ${day.weekday}`;
        if (seen.has(day.weekday)) {
            errors.push(`${name} is listed twice`);
            continue;
        }
        seen.add(day.weekday);

        if (!day.opens || !day.closes) {
            errors.push(`${name} needs an opening and a closing time, or mark it closed`);
        }
    }

    return errors;
}
