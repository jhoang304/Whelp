import React from "react";

import "./ChipPicker.css";

export interface ChipOption {
    id: number;
    name: string;
}

interface ChipPickerProps {
    title: string;
    options: ChipOption[];
    selected: number[];
    onChange: (ids: number[]) => void;
    /** When set, the picker stops taking new choices at this many. */
    max?: number;
    /** Shown on the right of the heading; defaults to the count. */
    hint?: string;
}

/**
 * A closed list of things to pick from, as chips.
 *
 * Cuisines and amenities are the same control with a different list, and this
 * was written twice for a while: the first copy had its CSS collide with both
 * restaurant forms, and so, separately, did the second. One component now,
 * with the list handed in.
 */
function ChipPicker({ title, options, selected, onChange, max, hint }: ChipPickerProps): React.JSX.Element {
    const toggle = (id: number) => {
        if (selected.includes(id)) {
            onChange(selected.filter((kept) => kept !== id));
        } else if (max === undefined || selected.length < max) {
            onChange([...selected, id]);
        }
    };

    const full = max !== undefined && selected.length >= max;

    return (
        <div className="chip-picker">
            <div className="chip-picker-heading">
                <span className="chip-picker-title">{title}</span>
                <span className="chip-picker-hint">
                    {hint ?? (max === undefined
                        ? `${selected.length} chosen`
                        : `${selected.length} of ${max} chosen`)}
                </span>
            </div>
            {/* Each chip carries its own class rather than being styled as a
                bare `button`: this sits inside forms whose CSS styles every
                button they contain, and the edit form's submit button is
                150x56 and red. */}
            <div className="chip-picker-options">
                {options.map((option) => {
                    const chosen = selected.includes(option.id);
                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={chosen}
                            className={`chip-picker-option${chosen ? " chosen" : ""}`}
                            disabled={!chosen && full}
                            title={!chosen && full
                                ? `Remove one first: you can pick up to ${max}`
                                : option.name}
                            onClick={() => toggle(option.id)}
                        >
                            {option.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default ChipPicker;
