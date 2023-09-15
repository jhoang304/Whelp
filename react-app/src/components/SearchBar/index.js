import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink, useParams } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';

import './SearchBar.css';

function RestaurantBySearch() {
    const dispatch = useDispatch()
    const { keyword } = useParams();


    useEffect(() => {
        dispatch(search_restaurants(keyword))
    }, [dispatch, keyword])


    const singleRestaurant = useSelector((state) => {
        return state.Restaurants.singleRestaurant
    })
    const restaurant = useSelector(state => state.Restaurants.searchedRestaurants)
    const restaurantArr = Object.values(restaurant)



    return restaurantArr &&(
        <div className='search-restaurants-container'>
            <div className='search-captions-container'>
                <div className='search-captions'>
                {restaurantArr?.length > 0 ?
                    <><div className='search-cap'> {restaurantArr?.length} search results for "{keyword}"</div><span className='search-cap'></span></>
                    :
                    <><div className='search-cap'> We couldn't find any results for "{keyword}"</div></>
                }
                </div>
            </div>
            <div className='search-box'>
                <div className='search-restaurant-box'>

                {restaurantArr?.map((el, i) => {
                    return (
                    <div className='search-restaurant-body'>
                        <NavLink to={`/single/${el?.id}`}  key={i} className="searchBar-link">
                                <img src={el?.previewImage} className='prevImage' alt='images'></img>
                            <div className='restaurant-info'>
                                <div className='restaurant-info1'>
                                    <div className='search-restaurant-name'><strong>{el.name}</strong></div>

                                    <div className='search-restaurant-price-city'>{el.price} · {el.city}</div>
                                </div>
                                <div className='restaurant-info2'>
                                    <p className='owned_operated'><i class="fa-regular fa-map"></i> Locally owned & operated</p>
                                <div className='waitlist-div'>
                                    <p><i class="fa-regular fa-clock"></i> Waitlist opens at 2pm</p>
                                </div>
                                </div>
                                <div className='restaurant-info3'>
                                    <p><i className='checkmark' class="fa-sharp fa-solid fa-check"></i>Outdoor Seating </p>
                                    <p> <i className='checkmark' class="fa-sharp fa-solid fa-check"></i> Delivery </p>
                                    <p> <i className='checkmark' class="fa-sharp fa-solid fa-check"></i> Takeout</p>
                                </div>
                            </div>
                        </NavLink>
                    </div>
                    )
                    })}
                </div>
            </div>
    </div>
  )
}

export default RestaurantBySearch
