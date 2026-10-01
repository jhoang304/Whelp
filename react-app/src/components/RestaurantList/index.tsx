import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom"
import "./RestaurantList.css"
import RestaurantListEntry from "../RestaurantListEntry";
import FilterBar from "../FilterBar";
import Loading from "../Loading";
import "../../styles/show-more.css";
import { getAllRestaurants, inOrder } from "../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../store";
import { NO_FILTERS, RestaurantFilters, filterSearch, isFiltered, readFilters } from "../../utils/filters";
import { pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";

function RestaurantList(): React.JSX.Element {
    const byId = useAppSelector((state) => state.Restaurants.allRestaurants);
    const ids = useAppSelector((state) => state.Restaurants.allRestaurantIds);
    // In the order the API sorted them: the map on its own lists them by id.
    const allRestaurants = useMemo(() => inOrder(byId, ids), [byId, ids]);

    const total = useAppSelector((state) => state.Restaurants.totalRestaurants ?? 0);
    const loadedPage = useAppSelector((state) => state.Restaurants.loadedPage ?? 1);
    const listError = useAppSelector((state) => state.Restaurants.listError);
    const categories = useAppSelector((state) => state.categories.list);

    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    // Why the list couldn't be loaded at all (not a refused filter, which is
    // listError), or why Show more couldn't. A dropped connection used to
    // leave the spinner up for good (#116).
    const [loadErrors, setLoadErrors] = useState<string[] | null>(null);
    const [moreError, setMoreError] = useState<string | null>(null);
    // Bumped by Try again, to load the same filters again.
    const [attempt, setAttempt] = useState<number>(0);
    const dispatch = useAppDispatch();
    const history = useHistory();
    const location = useLocation();

    // The URL holds the filters, so a filtered listing can be shared, reloaded
    // and stepped back out of. Memoised on the query string: a fresh object
    // every render would restart the effect below forever.
    const filters = useMemo(() => readFilters(location.search), [location.search]);
    // Counts each change of filters. A Show more still on its way when they
    // change belongs to the old list: its answer is dropped by the store, and
    // here it must not end the new list's own Show more (#115).
    const listVersion = useRef(0);

    useEffect(() => {
        // Page 1 replaces whatever a previous visit left behind, so coming
        // back to the listing does not start halfway down someone else's
        // scroll -- and a change of filter starts at the top of its own
        // results rather than appending them to the last set.
        let cancelled = false;
        listVersion.current += 1;
        setIsLoaded(false);
        setIsLoadingMore(false);
        setMoreError(null);
        // Only this filter's answer ends the loading: an earlier one arriving
        // late used to show the new filter's count over the old results.
        dispatch(getAllRestaurants(1, filters)).then((errors) => {
            if (cancelled) return;
            setLoadErrors(errors);
            setIsLoaded(true);
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, filters, attempt]);

    const applyFilters = (next: RestaurantFilters) => {
        history.push({ pathname: "/restaurants", search: filterSearch(next) });
    };

    const showMore = async () => {
        const version = listVersion.current;
        setIsLoadingMore(true);
        setMoreError(null);
        const errors = await dispatch(getAllRestaurants(loadedPage + 1, filters));
        if (version !== listVersion.current) return;
        setIsLoadingMore(false);
        if (errors) setMoreError(errors[0]);
    };

    const hasMore = allRestaurants.length < total;

    // The page's heading, and the cuisine's name when there is one (#122).
    const cuisine = categories.find((category) => category.slug === filters.category);
    // "Italian restaurants in Houston", or as much of it as the filters say.
    useDocumentTitle(pageTitle(`${cuisine ? `${cuisine.name} restaurants` : "Restaurants"}${filters.city ? ` in ${filters.city}` : ""}`));

    return (
        <>
            <h1 className="restaurant-list-title">{cuisine ? cuisine.name : "All restaurants"}</h1>
            <FilterBar
                filters={filters}
                onChange={applyFilters}
                total={isLoaded && !listError && !loadErrors ? total : undefined}
            />

            {!isLoaded ? (
                <Loading />
            ) : listError ? (
                // A refused filter and an empty result read the same on the
                // page unless the message is shown, and only one of them is
                // worth clearing the filters over.
                <div className="filter-empty">
                    <h2>We could not use those filters</h2>
                    <p>{listError}</p>
                    <button type="button" onClick={() => applyFilters(NO_FILTERS)}>
                        Clear filters
                    </button>
                </div>
            ) : loadErrors ? (
                <div className="filter-empty" role="alert">
                    <h2>We couldn't load restaurants</h2>
                    <p>{loadErrors[0]}</p>
                    <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                        Try again
                    </button>
                </div>
            ) : allRestaurants.length === 0 ? (
                <div className="filter-empty">
                    <h2>No restaurants match these filters</h2>
                    <p>Try a different cuisine, or widen the price or rating.</p>
                    {isFiltered(filters) && (
                        <button type="button" onClick={() => applyFilters(NO_FILTERS)}>
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="restaurant-list">
                        {
                            allRestaurants.map((restaurant, index) => {
                                // Stagger by 0.1s, but only across the first row: at
                                // index * 0.1 a hundred cards would still be arriving
                                // ten seconds after the page loaded.
                                const delay = Math.min(index, 3) * 0.1;
                                return (
                                    <RestaurantListEntry
                                        key={restaurant.id}
                                        className="restaurant-list-item"
                                        restaurant={restaurant}
                                        delay={delay}
                                    />
                                )
                            })
                        }
                    </div>
                    {hasMore && (
                        <div className="show-more">
                            <button
                                className="show-more-button"
                                onClick={showMore}
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore ? "Loading…" : `Show more (${allRestaurants.length} of ${total})`}
                            </button>
                            {moreError && <p className="show-more-error" role="alert">{moreError}</p>}
                        </div>
                    )}
                </>
            )}
        </>
    )
}


export default RestaurantList
