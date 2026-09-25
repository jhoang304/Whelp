import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useHistory, useLocation } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';
import Restaurant from '../Restaurant';
import FilterBar from '../FilterBar';
import { useAppDispatch, useAppSelector } from "../../store";
import {
    NO_FILTERS, RestaurantFilters, filterSearch, isFiltered, readFilters,
} from "../../utils/filters";

import './SearchBar.css';

interface SearchParams {
    keyword: string;
}

function RestaurantBySearch(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const history = useHistory();
    const location = useLocation();
    const { keyword } = useParams<SearchParams>();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    // Bumped by Try Again, to run the search again without reloading the
    // whole app -- which threw away the session state and the scroll.
    const [attempt, setAttempt] = useState<number>(0);

    // The filters live in the URL here too, so a filtered search is a link.
    const filters = useMemo(() => readFilters(location.search), [location.search]);

    useEffect(() => {
        const performSearch = async () => {
            if (!keyword || keyword.trim().length === 0) {
                history.push('/restaurants');
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await dispatch(search_restaurants(decodeURIComponent(keyword), 1, filters));
            } catch (err) {
                setError('Search failed. Please try again.');
                console.error('Search error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [dispatch, keyword, history, filters, attempt]);

    const restaurant = useAppSelector((state) =>
        state.Restaurants.searchedRestaurants || {}
    );
    const restaurantArr = Object.values(restaurant);
    const total = useAppSelector((state) => state.Restaurants.totalSearched ?? 0);
    const loadedPage = useAppSelector((state) => state.Restaurants.searchedPage ?? 1);
    // A filter the API refused reads as "no results" unless it is shown.
    const searchError = useAppSelector((state) => state.Restaurants.searchError);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    const applyFilters = (next: RestaurantFilters) => {
        history.push({ pathname: `/search/${keyword}`, search: filterSearch(next) });
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
                            {total} search result{total !== 1 ? 's' : ''} for "{decodeURIComponent(keyword)}"
                            {isFiltered(filters) ? ", filtered" : ""}
                        </div>
                    ) : (
                        <div className='search-cap'>
                            We couldn't find any results for "{decodeURIComponent(keyword)}"
                        </div>
                    )}
                </div>
            </div>

            <div className='search-restaurant-list'>
                {restaurantArr?.map((restaurant, index) => {
                    // Only the first row staggers; see RestaurantList.
                    const delay = Math.min(index, 3) * 0.1;
                    return (
                        <Link
                            className="search-restaurant-list-item"
                            key={restaurant.id}
                            to={`/single/${restaurant.id}`}
                            style={{ animationDelay: `${delay}s` }}
                        >
                            <Restaurant restaurant={restaurant} />
                        </Link>
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
