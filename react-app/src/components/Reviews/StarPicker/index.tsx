import React, { useId, useState } from "react";
import { STAR_FILL, STAR_PATH } from "../../RatingStar";
import "./StarPicker.css";

/** What each rating means, as the picker says it: RATING_MEANINGS[3] is "OK". */
export const RATING_MEANINGS = ["", "Not good", "Could've been better", "OK", "Good", "Great"];

/** An empty star's edge and its star: 3.3:1 on white, enough to see what to click. */
const EMPTY_EDGE = "#8f8f8f";

const RATINGS = [1, 2, 3, 4, 5];

interface StarPickerProps {
    /** Null until one is chosen: no rating is picked for the reader. */
    value: number | null;
    onChange: (rating: number) => void;
    /** The first star, for the form to send focus to when no rating was chosen. */
    firstStarRef?: React.Ref<HTMLInputElement>;
}

/**
 * The rating, as stars to click (#132). It was a select of 1 to 5 that
 * started at 3, so a reviewer who didn't notice it gave every place a 3.
 * It starts empty, and the form won't send a review without one.
 *
 * Five radio buttons under one name, behind the drawings: the keyboard
 * gets the arrow keys, a screen reader hears "3 stars, OK, radio button,
 * 3 of 5", and pointing at a star shows what clicking it would give.
 */
function StarPicker({ value, onChange, firstStarRef }: StarPickerProps): React.JSX.Element {
    const name = useId();
    const [pointedAt, setPointedAt] = useState<number | null>(null);
    const shown = pointedAt ?? value;

    return (
        <fieldset className="star-picker">
            <legend className="star-picker-legend">Your rating</legend>
            <div className="star-picker-row">
                <div className="star-picker-stars" onMouseLeave={() => setPointedAt(null)}>
                    {RATINGS.map((rating) => {
                        const filled = shown !== null && rating <= shown;
                        return (
                            <label
                                key={rating}
                                className={filled ? "star-picker-star filled" : "star-picker-star"}
                                onMouseEnter={() => setPointedAt(rating)}
                            >
                                <input
                                    ref={rating === 1 ? firstStarRef : undefined}
                                    type="radio"
                                    name={name}
                                    value={rating}
                                    checked={value === rating}
                                    onChange={() => onChange(rating)}
                                    required
                                    aria-label={`${rating} ${rating === 1 ? "star" : "stars"}, ${RATING_MEANINGS[rating]}`}
                                />
                                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                                    <rect
                                        x="0.5" y="0.5" width="19" height="19" rx="4"
                                        fill={filled ? STAR_FILL : "white"}
                                        stroke={filled ? STAR_FILL : EMPTY_EDGE}
                                    />
                                    <path d={STAR_PATH} fill={filled ? "white" : EMPTY_EDGE} />
                                </svg>
                            </label>
                        );
                    })}
                </div>
                {/* What the stars say, for the eye; each star's own name
                    says it to a screen reader. */}
                <span className={shown ? "star-picker-meaning chosen" : "star-picker-meaning"} aria-hidden="true">
                    {shown ? RATING_MEANINGS[shown] : "Select your rating"}
                </span>
            </div>
        </fieldset>
    );
}

export default StarPicker;
