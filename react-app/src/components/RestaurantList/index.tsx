import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom"
import "./RestaurantList.css"
import Restaurant from "../Restaurant"
import { getAllRestaurants } from "../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../store";

function RestaurantList(): React.JSX.Element {
    const allRestaurantObj = useAppSelector((state) => {
        return state.Restaurants.allRestaurants
    });

    const allRestaurants = allRestaurantObj ? Object.values(allRestaurantObj) : [];

    const total = useAppSelector((state) => state.Restaurants.totalRestaurants ?? 0);
    const loadedPage = useAppSelector((state) => state.Restaurants.loadedPage ?? 1);

    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const dispatch = useAppDispatch();

    useEffect(() => {
        // Page 1 replaces whatever a previous visit left behind, so coming
        // back to the listing does not start halfway down someone else's
        // scroll.
        dispatch(getAllRestaurants(1)).then(() => setIsLoaded(true));
    }, [dispatch]);

    const showMore = async () => {
        setIsLoadingMore(true);
        await dispatch(getAllRestaurants(loadedPage + 1));
        setIsLoadingMore(false);
    };

    const hasMore = allRestaurants.length < total;

    if (!isLoaded) {
        return (
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
        );
    }

    return (
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
    )
}


export default RestaurantList
