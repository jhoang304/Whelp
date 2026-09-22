import {
    NO_FILTERS, filterSearch, isFiltered, readFilters, togglePrice,
} from "./filters";

test("reads every filter out of a query string", () => {
    expect(readFilters("?category=pizza&price=$&price=$$$&min_rating=4.5&city=Houston&sort=rating"))
        .toEqual({
            category: "pizza",
            prices: ["$", "$$$"],
            minRating: 4.5,
            city: "Houston",
            sort: "rating",
        });
});

test("an empty query string is no filters at all", () => {
    expect(readFilters("")).toEqual(NO_FILTERS);
    expect(isFiltered(readFilters(""))).toBe(false);
});

test("drops what the API would refuse rather than sending it on", () => {
    // A hand-typed URL should leave the page working; the API is the one that
    // says no, and it only ever sees what it offers.
    const filters = readFilters("?sort=alphabetical&price=cheap&min_rating=lots");
    expect(filters.sort).toBeNull();
    expect(filters.prices).toEqual([]);
    expect(filters.minRating).toBeNull();
});

test("keeps a zero minimum rating, which is not the same as no filter", () => {
    expect(readFilters("?min_rating=0").minRating).toBe(0);
});

test("writes back the query string it read", () => {
    const search = "?category=pizza&price=%24&min_rating=4&city=Houston&sort=newest";
    expect(filterSearch(readFilters(search))).toBe(search);
});

test("no filters is no query string, not a bare question mark", () => {
    expect(filterSearch(NO_FILTERS)).toBe("");
});

test("a sort on its own counts as filtered, so the page offers to clear it", () => {
    expect(isFiltered(readFilters("?sort=newest"))).toBe(true);
});

test("toggling a price adds it, in the order the options are offered", () => {
    expect(togglePrice(["$$$"], "$")).toEqual(["$", "$$$"]);
});

test("toggling a price already chosen takes it out", () => {
    expect(togglePrice(["$", "$$$"], "$")).toEqual(["$$$"]);
});
