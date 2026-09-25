import React from "react";

import "./HoursEditor.css";
import { OpeningHours } from "../../types";
import {
    DEFAULT_CLOSES, DEFAULT_OPENS, WEEKDAYS, byWeekday, runsPastMidnight,
} from "../../utils/hours";

/** The zones the app knows how to suggest, plus whatever a restaurant already has. */
const COMMON_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
];

interface HoursEditorProps {
    value: OpeningHours[];
    onChange: (next: OpeningHours[]) => void;
    timezone: string | null;
    onTimezoneChange: (next: string | null) => void;
    /** The editor's own heading; null where a section around it has one. */
    title?: string | null;
}

/**
 * A row per day, each one open or closed.
 *
 * Closing a day removes its row rather than storing a flag, because that is
 * what the API means by closed: a day with no row. A restaurant that opens
 * later on Fridays can say so, which a single range applied to ticked days
 * could not.
 */
function HoursEditor({ value, onChange, timezone, onTimezoneChange, title = "Opening hours" }: HoursEditorProps): React.JSX.Element {
    const byDay = new Map(value.map((day) => [day.weekday, day]));

    const setDay = (weekday: number, changes: Partial<OpeningHours>) => {
        const existing = byDay.get(weekday);
        if (!existing) return;
        onChange(byWeekday([
            ...value.filter((day) => day.weekday !== weekday),
            { ...existing, ...changes },
        ]));
    };

    const toggleDay = (weekday: number) => {
        if (byDay.has(weekday)) {
            onChange(value.filter((day) => day.weekday !== weekday));
        } else {
            onChange(byWeekday([
                ...value,
                { weekday, opens: DEFAULT_OPENS, closes: DEFAULT_CLOSES },
            ]));
        }
    };

    const zones = timezone && !COMMON_TIMEZONES.includes(timezone)
        ? [timezone, ...COMMON_TIMEZONES]
        : COMMON_TIMEZONES;

    return (
        <div className="hours-editor">
            <div className="hours-editor-heading">
                {title && <span className="hours-editor-title">{title}</span>}
                <label className="hours-editor-timezone">
                    <span>Times are in</span>
                    <select
                        value={timezone || ""}
                        onChange={(event) => onTimezoneChange(event.target.value || null)}
                    >
                        <option value="">Not set</option>
                        {zones.map((zone) => (
                            <option key={zone} value={zone}>{zone.replace("_", " ")}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="hours-editor-days">
                {WEEKDAYS.map((name, weekday) => {
                    const day = byDay.get(weekday);
                    return (
                        <div className="hours-editor-day" key={name}>
                            <label className="hours-editor-open">
                                <input
                                    type="checkbox"
                                    checked={Boolean(day)}
                                    onChange={() => toggleDay(weekday)}
                                />
                                <span>{name}</span>
                            </label>

                            {day ? (
                                <div className="hours-editor-times">
                                    <input
                                        type="time"
                                        aria-label={`${name} opens`}
                                        value={day.opens}
                                        onChange={(event) => setDay(weekday, { opens: event.target.value })}
                                    />
                                    <span className="hours-editor-dash">to</span>
                                    <input
                                        type="time"
                                        aria-label={`${name} closes`}
                                        value={day.closes}
                                        onChange={(event) => setDay(weekday, { closes: event.target.value })}
                                    />
                                    {runsPastMidnight(day) && (
                                        <span className="hours-editor-overnight" title="Closing time is the next morning">
                                            next day
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="hours-editor-closed">Closed</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {!timezone && value.length > 0 && (
                <p className="hours-editor-note">
                    Choose a timezone, or these hours cannot say whether you are open now.
                </p>
            )}
        </div>
    );
}

export default HoursEditor;
