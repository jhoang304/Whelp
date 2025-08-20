import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux";
import "./RestaurantList.css"
import Restaurant from "../Restaurant"
import { getAllRestaurants } from "../../store/restaurants";
import { RootState } from "../../types";
import { AppDispatch } from "../../store";

function RestaurantList(): React.JSX.Element {
    const allRestaurantObj = useSelector((state: RootState) => {
        return state.Restaurants.allRestaurants
    });

    const allRestaurants = allRestaurantObj ? Object.values(allRestaurantObj) : [];

    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const dispatch = useDispatch<AppDispatch>();
    
    useEffect(() => {
        dispatch(getAllRestaurants() as any).then(() => setIsLoaded(true));
    }, [dispatch]);

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
                        const delay = index * 0.1; // Stagger delay by 0.1s per item
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
        </>
    )
}


export default RestaurantList
