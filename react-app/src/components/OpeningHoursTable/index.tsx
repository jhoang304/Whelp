import React from "react";

import "./OpeningHoursTable.css";
import { OpeningHours } from "../../types";
import { WEEKDAYS, byWeekday, formatTime, runsPastMidnight } from "../../utils/hours";

interface OpeningHoursTableProps {
    hours?: OpeningHours[];
    timezone?: string | null;
}

/**
 * The week, with the days a restaurant is closed shown as closed.
 *
 * Nothing renders at all when there are no hours: a restaurant that has never
 * said is not a restaurant that is shut every day, and a table of seven
 * "Closed" rows would be a claim nobody made.
 */
function OpeningHoursTable({ hours, timezone }: OpeningHoursTableProps): React.JSX.Element | null {
    if (!hours || hours.length === 0) return null;

    const byDay = new Map(byWeekday(hours).map((day) => [day.weekday, day]));
    const today = new Date().getDay();
    // JavaScript counts from Sunday, the API from Monday.
    const todayIndex = (today + 6) % 7;

    return (
        <>
            <h2>Opening Hours</h2>
            <table className="opening-hours">
                <tbody>
                    {WEEKDAYS.map((name, weekday) => {
                        const day = byDay.get(weekday);
                        return (
                            <tr key={name} className={weekday === todayIndex ? "today" : ""}>
                                <th scope="row">{name}</th>
                                <td>
                                    {day ? (
                                        <>
                                            {formatTime(day.opens)} – {formatTime(day.closes)}
                                            {runsPastMidnight(day) && (
                                                <span className="opening-hours-overnight"> (next day)</span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="opening-hours-closed">Closed</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {timezone && (
                <p className="opening-hours-timezone">Times shown in {timezone.replace("_", " ")}</p>
            )}
        </>
    );
}

export default OpeningHoursTable;
