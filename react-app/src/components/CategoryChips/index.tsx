import React from "react";
import { useHistory } from "react-router-dom";

import "./CategoryChips.css";
import { Category } from "../../types";

interface CategoryChipsProps {
    categories?: Category[] | null;
    className?: string;
}

/**
 * A restaurant's cuisines, each one a way to see the others like it.
 *
 * Buttons rather than links: a card is already wrapped in a Link, and an
 * anchor inside an anchor is invalid HTML that browsers untangle however they
 * please. The click is stopped from reaching that wrapper as well, so a chip
 * goes to the cuisine rather than to the restaurant it sits on.
 */
function CategoryChips({ categories, className = "" }: CategoryChipsProps): React.JSX.Element | null {
    const history = useHistory();

    if (!categories || categories.length === 0) return null;

    const openCategory = (event: React.MouseEvent<HTMLButtonElement>, slug: string) => {
        event.preventDefault();
        event.stopPropagation();
        history.push(`/restaurants?category=${encodeURIComponent(slug)}`);
    };

    return (
        <div className={`category-chips ${className}`.trim()}>
            {categories.map((category) => (
                <button
                    key={category.id}
                    type="button"
                    className="category-chip"
                    title={`See other ${category.name} restaurants`}
                    onClick={(event) => openCategory(event, category.slug)}
                >
                    {category.name}
                </button>
            ))}
        </div>
    );
}

export default CategoryChips;
