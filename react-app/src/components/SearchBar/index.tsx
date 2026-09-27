import React, { useState, useEffect, useMemo } from 'react';
import { Link, Redirect, useParams, useHistory, useLocation } from "react-router-dom";
import { inOrder, search_restaurants } from '../../store/restaurants';
import RestaurantListEntry from '../RestaurantListEntry';
import FilterBar from '../FilterBar';
import { useAppDispatch, useAppSelector } from "../../store";
import {
    NO_FILTERS, RestaurantFilters, isFiltered, readFilters, readKeyword, searchLocation,
} from "../../utils/filters";

import './SearchBar.css';

/**
 * `/search/:keyword`, the old form of a search link: bookmarks and shared
 * links still use it. Sends it on to `/search?q=`, keeping any filters.
 *
 * The router has already run decodeURI over the path, so what arrives is
 * half-decoded: "bar %26 grill" (decodeURI leaves &, /, ? and # escaped)
 * or "100% beef" (a lone % it did decode). Decode the rest, and keep it as
 * it is when it will not decode.
 */
export function LegacySearchRedirect(): React.JSX.Element {
    const { keyword } = useParams<{ keyword: string }>();
    const location = useLocation();
    let decoded = keyword;
    try {
        decoded = decodeURIComponent(keyword);
    } catch {
        // a literal % in the keyword: it is already as decoded as it gets
    }
    return <Redirect to={searchLocation(decoded, readFilters(location.search))} />;
}

function RestaurantBySearch(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const history = useHistory();
    const location = useLocation();
    // Decoded exactly once, by URLSearchParams, and used as it is everywhere
    // below: the first page, Show more, the filters and the caption.
    const keyword = useMemo(() => readKeyword(location.search), [location.search]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    // Bumped by Try Again, to run the search again without reloading the
    // whole app -- which threw away the session state and the scroll.
    const [attempt, setAttempt] = useState<number>(0);

    // The filters live in the URL here too, so a filtered search is a link.
    const filters = useMemo(() => readFilters(location.search), [location.search]);

    useEffect(() => {
        const performSearch = async () => {
            if (!keyword) {
                // Replace, not push: Back from the listing would otherwise
                // land here again and bounce straight back to it.
                history.replace('/restaurants');
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await dispatch(search_restaurants(keyword, 1, filters));
            } catch (err) {
                setError('Search failed. Please try again.');
                console.error('Search error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [dispatch, keyword, history, filters, attempt]);

    const byId = useAppSelector((state) => state.Restaurants.searchedRestaurants);
    const ids = useAppSelector((state) => state.Restaurants.searchedIds);
    // Most relevant first, or in the chosen sort: the map on its own lists
    // them by id.
    const restaurantArr = useMemo(() => inOrder(byId, ids), [byId, ids]);
    const total = useAppSelector((state) => state.Restaurants.totalSearched ?? 0);
    const loadedPage = useAppSelector((state) => state.Restaurants.searchedPage ?? 1);
    // A filter the API refused reads as "no results" unless it is shown.
    const searchError = useAppSelector((state) => state.Restaurants.searchError);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    const applyFilters = (next: RestaurantFilters) => {
        history.push(searchLocation(keyword, next));
    };

    const showMore = async () => {
        setIsLoadingMore(true);
        await dispatch(search_restaurants(keyword, loadedPage + 1, filters));
        setIsLoadingMore(false);
    };

    if (isLoading) {
        return (
            <div className='search-restaurants-container'>
                <div className='search-loading'>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <p>Searching restaurants...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='search-restaurants-container'>
                <div className='search-error' role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className='search-restaurants-container'>
            <FilterBar filters={filters} onChange={applyFilters} />

            {searchError ? (
                <div className="filter-empty">
                    <h3>We could not run that search</h3>
                    <p>{searchError}</p>
                    {isFiltered(filters) && (
                        <button type="button" onClick={() => applyFilters(NO_FILTERS)}>
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
            <>
            <div className='search-captions-container'>
                <div className='search-captions'>
                    {total > 0 ? (
                        <div className='search-cap'>
                            {/* the total, not how many are on screen: "20 search
                                results" under a Show more button is a lie */}
                            {total} search result{total !== 1 ? 's' : ''} for "{keyword}"
                            {isFiltered(filters) ? ", filtered" : ""}
                        </div>
                    ) : (
                        <div className='search-cap'>
                            We couldn't find any results for "{keyword}"
                        </div>
                    )}
                </div>
            </div>

            <div className='search-restaurant-list'>
                {restaurantArr?.map((restaurant, index) => {
                    // Only the first row staggers; see RestaurantList.
                    const delay = Math.min(index, 3) * 0.1;
                    return (
                        <RestaurantListEntry
                            key={restaurant.id}
                            className="search-restaurant-list-item"
                            restaurant={restaurant}
                            delay={delay}
                        />
                    );
                })}
                {restaurantArr.length < total && (
                    <div className="restaurant-list-more">
                        <button
                            className="restaurant-list-more-button"
                            onClick={showMore}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore
                                ? "Loading…"
                                : `Show more (${restaurantArr.length} of ${total})`}
                        </button>
                    </div>
                )}

                {restaurantArr?.length === 0 && (
                    <div className='no-results-suggestions'>
                        <h3>Try searching for:</h3>
                        <ul>
                            <li>Restaurant names (e.g., "Pizza Palace")</li>
                            <li>Cuisine types (e.g., "Italian", "Mexican")</li>
                            <li>Cities or locations (e.g., "San Francisco")</li>
                        </ul>
                        {isFiltered(filters) && (
                            <button
                                type="button"
                                className="search-clear-filters"
                                onClick={() => applyFilters(NO_FILTERS)}
                            >
                                Clear filters
                            </button>
                        )}
                        <Link to="/restaurants" className="view-all-link">
                            View All Restaurants
                        </Link>
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    );
}

export default RestaurantBySearch
