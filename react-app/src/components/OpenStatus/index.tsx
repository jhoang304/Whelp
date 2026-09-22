import React from "react";

import "./OpenStatus.css";
import { OpenStatus as Status } from "../../types";
import { describeOpenStatus } from "../../utils/hours";

interface OpenStatusProps {
    status?: Status;
    className?: string;
}

/**
 * "Open until 10:00 PM", or "Closed · Opens 11:00 AM Tuesday".
 *
 * Nothing at all when the API sends null, which is what it does for a
 * restaurant with no hours or no timezone. Every restaurant used to claim it
 * was open until 9:30PM because that was typed into the card; a restaurant
 * that has not said when it opens should say nothing instead of guessing in
 * either direction.
 */
function OpenStatus({ status, className = "" }: OpenStatusProps): React.JSX.Element | null {
    const described = describeOpenStatus(status ?? null);
    if (!described) return null;

    return (
        <div className={`open-status ${className}`.trim()}>
            <span className={described.isOpen ? "open-now" : "closed-now"}>
                {described.isOpen ? "Open" : "Closed"}
            </span>
            {described.text && (
                <span className="open-status-detail">
                    {/* "Open until 10:00 PM" reads as one phrase; "Closed" and
                        "Opens 11:00 AM Tuesday" are two, and need parting. */}
                    {described.isOpen ? " " : " · "}{described.text}
                </span>
            )}
        </div>
    );
}

export default OpenStatus;
