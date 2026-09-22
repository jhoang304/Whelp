/**
 * The filters the listing and the search share, read from and written to the
 * URL.
 *
 * The browser URL uses the API's own parameter names, so /restaurants?price=$$
 * and /api/restaurants?price=$$ ask the same question. That is what lets a
 * filtered page be pasted to someone else, survive a reload, and come back
 * with the browser's Back button -- none of which component state can do.
 */

export type SortKey = "rating" | "reviews" | "newest";

export interface RestaurantFilters {
    /** a category slug, as /api/categories serves them */
    category: string | null;
    prices: string[];
    minRating: number | null;
    city: string | null;
    sort: SortKey | null;
}

export const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$", "$$$$$"];

export const RATING_OPTIONS = [3, 3.5, 4, 4.5];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "rating", label: "Highest rated" },
    { value: "reviews", label: "Most reviewed" },
    { value: "newest", label: "Newest" },
];

export const NO_FILTERS: RestaurantFilters = {
    category: null,
    prices: [],
    minRating: null,
    city: null,
    sort: null,
};

const isSortKey = (value: string | null): value is SortKey =>
    SORT_OPTIONS.some((option) => option.value === value);

/**
 * The filters a URL is asking for. Anything the API would refuse is dropped
 * rather than sent on: a hand-typed ?sort=alphabetical should leave the page
 * working, and the API says the same by rejecting only what it is given.
 */
export function readFilters(search: string): RestaurantFilters {
    const params = new URLSearchParams(search);

    const rawRating = params.get("min_rating");
    const rating = rawRating === null || rawRating.trim() === "" ? NaN : Number(rawRating);
    const sort = params.get("sort");

    return {
        category: params.get("category") || null,
        prices: params.getAll("price").filter((price) => PRICE_OPTIONS.includes(price)),
        minRating: Number.isNaN(rating) ? null : rating,
        city: params.get("city") || null,
        sort: isSortKey(sort) ? sort : null,
    };
}

/** The same filters as query parameters, for a fetch or for the address bar. */
export function filterParams(filters: RestaurantFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    filters.prices.forEach((price) => params.append("price", price));
    if (filters.minRating !== null) params.set("min_rating", String(filters.minRating));
    if (filters.city) params.set("city", filters.city);
    if (filters.sort) params.set("sort", filters.sort);
    return params;
}

/** "?category=pizza&sort=rating", or "" when nothing is filtered. */
export function filterSearch(filters: RestaurantFilters): string {
    const params = filterParams(filters).toString();
    return params ? `?${params}` : "";
}

/** True when something is actually narrowed or reordered. */
export function isFiltered(filters: RestaurantFilters): boolean {
    return Boolean(
        filters.category || filters.prices.length || filters.city ||
        filters.minRating !== null || filters.sort,
    );
}

/** A price in or out of the selection, keeping the order the options are in. */
export function togglePrice(prices: string[], price: string): string[] {
    return prices.includes(price)
        ? prices.filter((kept) => kept !== price)
        : PRICE_OPTIONS.filter((option) => option === price || prices.includes(option));
}
