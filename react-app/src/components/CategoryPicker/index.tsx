import React, { useEffect } from "react";

import "./CategoryPicker.css";
import { MAX_CATEGORIES, getCategories } from "../../store/categories";
import { useAppDispatch, useAppSelector } from "../../store";

interface CategoryPickerProps {
    /** the ids currently chosen */
    selected: number[];
    onChange: (ids: number[]) => void;
}

/**
 * What a restaurant serves, picked from the taxonomy rather than typed.
 *
 * The limit is the API's; it is enforced here as well so the picker stops
 * taking a fourth cuisine instead of letting the whole save come back as a
 * 400 after everything else has been filled in.
 */
function CategoryPicker({ selected, onChange }: CategoryPickerProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const categories = useAppSelector((state) => state.categories.list);

    useEffect(() => {
        if (categories.length === 0) dispatch(getCategories());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const toggle = (id: number) => {
        if (selected.includes(id)) {
            onChange(selected.filter((kept) => kept !== id));
        } else if (selected.length < MAX_CATEGORIES) {
            onChange([...selected, id]);
        }
    };

    const full = selected.length >= MAX_CATEGORIES;

    return (
        <div className="category-picker">
            <div className="category-picker-heading">
                <span>Cuisines</span>
                <span className="category-picker-hint">
                    {selected.length} of {MAX_CATEGORIES} chosen
                </span>
            </div>
            <div className="category-picker-options">
                {categories.map((category) => {
                    const chosen = selected.includes(category.id);
                    return (
                        <button
                            key={category.id}
                            type="button"
                            aria-pressed={chosen}
                            className={chosen ? "chosen" : ""}
                            disabled={!chosen && full}
                            title={!chosen && full
                                ? `Remove one first: a restaurant lists up to ${MAX_CATEGORIES}`
                                : category.name}
                            onClick={() => toggle(category.id)}
                        >
                            {category.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default CategoryPicker;
