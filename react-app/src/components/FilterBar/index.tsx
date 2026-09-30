import React, { useEffect } from "react";

import "./FilterBar.css";
import { getCategories, getCities } from "../../store/categories";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    NO_FILTERS, PRICE_OPTIONS, RATING_OPTIONS, RestaurantFilters, SORT_OPTIONS,
    isFiltered, togglePrice,
} from "../../utils/filters";

interface FilterBarProps {
    filters: RestaurantFilters;
    /** The page owns the URL; this hands it the filters to put there. */
    onChange: (next: RestaurantFilters) => void;
    /** How many restaurants came back, when the page knows. */
    total?: number;
}

/**
 * Cuisine, price, rating, city and sort.
 *
 * Every control offers what the API accepts and nothing else -- the cuisines
 * and the cities are read from it rather than typed -- so a filter here can
 * always be answered. The bar itself holds no state: it renders what the URL
 * says and hands back what was clicked.
 */
function FilterBar({ filters, onChange, total }: FilterBarProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const categories = useAppSelector((state) => state.categories.list);
    const cities = useAppSelector((state) => state.categories.cities);

    useEffect(() => {
        // The cuisines are a closed list, fetched once and kept. The cities
        // are not: a restaurant added in a new city, moved, or the last one in
        // a city deleted changes them, and the filter didn't know until a
        // reload (#128). So they are asked for each time a list page opens --
        // one small request -- while the ones already known stay on show.
        if (categories.length === 0) dispatch(getCategories());
        dispatch(getCities());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const set = (change: Partial<RestaurantFilters>) => onChange({ ...filters, ...change });

    return (
        <div className="filter-bar">
            <label className="filter-control">
                <span className="filter-label">Cuisine</span>
                <select
                    value={filters.category || ""}
                    onChange={(event) => set({ category: event.target.value || null })}
                >
                    <option value="">All cuisines</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.slug}>{category.name}</option>
                    ))}
                </select>
            </label>

            <div className="filter-control">
                <span className="filter-label">Price</span>
                <div className="filter-prices" role="group" aria-label="Price">
                    {PRICE_OPTIONS.map((price) => (
                        <button
                            key={price}
                            type="button"
                            aria-pressed={filters.prices.includes(price)}
                            className={filters.prices.includes(price) ? "active" : ""}
                            onClick={() => set({ prices: togglePrice(filters.prices, price) })}
                        >
                            {price}
                        </button>
                    ))}
                </div>
            </div>

            <label className="filter-control">
                <span className="filter-label">Rating</span>
                <select
                    value={filters.minRating === null ? "" : String(filters.minRating)}
                    onChange={(event) => set({
                        minRating: event.target.value === "" ? null : Number(event.target.value),
                    })}
                >
                    <option value="">Any rating</option>
                    {RATING_OPTIONS.map((rating) => (
                        <option key={rating} value={rating}>{rating.toFixed(1)} and up</option>
                    ))}
                </select>
            </label>

            <label className="filter-control">
                <span className="filter-label">City</span>
                <select
                    value={filters.city || ""}
                    onChange={(event) => set({ city: event.target.value || null })}
                >
                    <option value="">Anywhere</option>
                    {cities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                    ))}
                </select>
            </label>

            <label className="filter-control">
                <span className="filter-label">Sort by</span>
                <select
                    value={filters.sort || ""}
                    onChange={(event) => set({
                        sort: (event.target.value || null) as RestaurantFilters["sort"],
                    })}
                >
                    <option value="">Default</option>
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </label>

            <div className="filter-summary">
                {typeof total === "number" && (
                    <span className="filter-count">
                        {total} restaurant{total === 1 ? "" : "s"}
                    </span>
                )}
                {isFiltered(filters) && (
                    <button
                        type="button"
                        className="filter-clear"
                        onClick={() => onChange(NO_FILTERS)}
                    >
                        Clear all
                    </button>
                )}
            </div>
        </div>
    );
}

export default FilterBar;
