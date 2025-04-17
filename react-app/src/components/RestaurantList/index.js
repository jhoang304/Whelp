import { useEffect } from "react";
import { Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react"
import "./RestaurantList.css"
import Restaurant from "../Restaurant"
import { getAllRestaurants } from "../../store/restaurants";
import OpenModalButton from "../OpenModalButton";
import CreateRestaurantModal from "../CreateRestaurantModal";


function RestaurantList() {
    const sessionUser = useSelector(state => state.session.user);

    const allRestaurantObj = useSelector((state) => {
        return state.Restaurants.allRestaurants
    })

    const allRestaurants = allRestaurantObj ? Object.values(allRestaurantObj) : [];

    const [isLoaded, setIsLoaded] = useState(false);
    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(getAllRestaurants()).then(() => setIsLoaded(true));
    }, [dispatch])

    return (
        isLoaded && (
            <>
                <div className="add-restaurant-button">
                    {sessionUser && (
                        <OpenModalButton
                            buttonText="Add Restaurant"
                            modalComponent={<CreateRestaurantModal />}
                        />
                    )}
                </div>
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
    )
}


export default RestaurantList
