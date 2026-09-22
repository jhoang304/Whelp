import React, { useEffect, useMemo, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom"
import "./RestaurantList.css"
import Restaurant from "../Restaurant"
import FilterBar from "../FilterBar";
import { getAllRestaurants } from "../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../store";
import { NO_FILTERS, RestaurantFilters, filterSearch, isFiltered, readFilters } from "../../utils/filters";

function RestaurantList(): React.JSX.Element {
    const allRestaurantObj = useAppSelector((state) => {
        return state.Restaurants.allRestaurants
    });

    const allRestaurants = allRestaurantObj ? Object.values(allRestaurantObj) : [];

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

    useEffect(() => {
        // Page 1 replaces whatever a previous visit left behind, so coming
        // back to the listing does not start halfway down someone else's
        // scroll -- and a change of filter starts at the top of its own
        // results rather than appending them to the last set.
        setIsLoaded(false);
        dispatch(getAllRestaurants(1, filters)).then(() => setIsLoaded(true));
    }, [dispatch, filters]);

    const applyFilters = (next: RestaurantFilters) => {
        history.push({ pathname: "/restaurants", search: filterSearch(next) });
    };

    const showMore = async () => {
        setIsLoadingMore(true);
        await dispatch(getAllRestaurants(loadedPage + 1, filters));
        setIsLoadingMore(false);
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
                                    <Link
                                        className="restaurant-list-item" // Changed class for clarity
                                        key={restaurant.id}
                                        to={`/single/${restaurant.id}`}
                                        style={{ animationDelay: `${delay}s` }} // Apply inline style for delay
                                    >
                                        <Restaurant restaurant={restaurant} />
                                    </Link>
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
