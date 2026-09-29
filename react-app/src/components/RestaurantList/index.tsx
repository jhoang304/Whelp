import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom"
import "./RestaurantList.css"
import RestaurantListEntry from "../RestaurantListEntry";
import FilterBar from "../FilterBar";
import { getAllRestaurants, inOrder } from "../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../store";
import { NO_FILTERS, RestaurantFilters, filterSearch, isFiltered, readFilters } from "../../utils/filters";

function RestaurantList(): React.JSX.Element {
    const byId = useAppSelector((state) => state.Restaurants.allRestaurants);
    const ids = useAppSelector((state) => state.Restaurants.allRestaurantIds);
    // In the order the API sorted them: the map on its own lists them by id.
    const allRestaurants = useMemo(() => inOrder(byId, ids), [byId, ids]);

    const total = useAppSelector((state) => state.Restaurants.totalRestaurants ?? 0);
    const loadedPage = useAppSelector((state) => state.Restaurants.loadedPage ?? 1);
    const listError = useAppSelector((state) => state.Restaurants.listError);

    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
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
        // Only this filter's answer ends the loading: an earlier one arriving
        // late used to show the new filter's count over the old results.
        dispatch(getAllRestaurants(1, filters)).then(() => {
            if (!cancelled) setIsLoaded(true);
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, filters]);

    const applyFilters = (next: RestaurantFilters) => {
        history.push({ pathname: "/restaurants", search: filterSearch(next) });
    };

    const showMore = async () => {
        const version = listVersion.current;
        setIsLoadingMore(true);
        await dispatch(getAllRestaurants(loadedPage + 1, filters));
        if (version === listVersion.current) setIsLoadingMore(false);
    };

    const hasMore = allRestaurants.length < total;

    return (
        <>
            <FilterBar
                filters={filters}
                onChange={applyFilters}
                total={isLoaded && !listError ? total : undefined}
            />

            {!isLoaded ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">
                        <span className="loading-word">Loading</span>
                        <span className="loading-dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                        </span>
                    </div>
                </div>
            ) : listError ? (
                // A refused filter and an empty result read the same on the
                // page unless the message is shown, and only one of them is
                // worth clearing the filters over.
                <div className="filter-empty">
                    <h3>We could not use those filters</h3>
                    <p>{listError}</p>
                    <button type="button" onClick={() => applyFilters(NO_FILTERS)}>
                        Clear filters
                    </button>
                </div>
            ) : allRestaurants.length === 0 ? (
                <div className="filter-empty">
                    <h3>No restaurants match these filters</h3>
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
                        <div className="restaurant-list-more">
                            <button
                                className="restaurant-list-more-button"
                                onClick={showMore}
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore ? "Loading…" : `Show more (${allRestaurants.length} of ${total})`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    )
}


export default RestaurantList
