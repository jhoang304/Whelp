import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useParams, useHistory } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';
import Restaurant from '../Restaurant';

import './SearchBar.css';

function RestaurantBySearch() {
    const dispatch = useDispatch();
    const history = useHistory();
    const { keyword } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const performSearch = async () => {
            if (!keyword || keyword.trim().length === 0) {
                history.push('/restaurants');
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await dispatch(search_restaurants(decodeURIComponent(keyword)));
            } catch (err) {
                setError('Search failed. Please try again.');
                console.error('Search error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [dispatch, keyword, history]);

    const restaurant = useSelector(state => state.Restaurants.searchedRestaurants || {});
    const restaurantArr = Object.values(restaurant);

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
                <div className='search-error'>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className='search-restaurants-container'>
            <div className='search-captions-container'>
                <div className='search-captions'>
                    {restaurantArr?.length > 0 ? (
                        <div className='search-cap'>
                            {restaurantArr.length} search result{restaurantArr.length !== 1 ? 's' : ''} for "{decodeURIComponent(keyword)}"
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
                    const delay = index * 0.1; // Stagger delay by 0.1s per item
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
                
                {restaurantArr?.length === 0 && (
                    <div className='no-results-suggestions'>
                        <h3>Try searching for:</h3>
                        <ul>
                            <li>Restaurant names (e.g., "Pizza Palace")</li>
                            <li>Cuisine types (e.g., "Italian", "Mexican")</li>
                            <li>Cities or locations (e.g., "San Francisco")</li>
                        </ul>
                        <Link to="/restaurants" className="view-all-link">
                            View All Restaurants
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RestaurantBySearch
