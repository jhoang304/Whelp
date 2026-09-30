import React from "react";
import { Link } from "react-router-dom";

import "./CategoryChips.css";
import { Category } from "../../types";

interface CategoryChipsProps {
    categories?: Category[] | null;
    className?: string;
}

/**
 * A restaurant's cuisines, each one a way to see the others like it.
 *
 * Links, which open in a new tab like any other. They were buttons inside the
 * card's link, which HTML does not allow; the card's link is its name now,
 * stretched under these (#122).
 */
function CategoryChips({ categories, className = "" }: CategoryChipsProps): React.JSX.Element | null {
    if (!categories || categories.length === 0) return null;

    return (
        <div className={`category-chips ${className}`.trim()}>
            {categories.map((category) => (
                <Link
                    key={category.id}
                    className="category-chip"
                    title={`See other ${category.name} restaurants`}
                    to={`/restaurants?category=${encodeURIComponent(category.slug)}`}
                >
                    {category.name}
                </Link>
            ))}
        </div>
    );
}

export default CategoryChips;
