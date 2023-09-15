
//Load all restaurants
const LOAD = "restaurants/loadRestaurants"
export const loadRestaurants = (list) => ({
    type: LOAD,
    allRestaurants: list
})

export const getAllRestaurants = () => async dispatch => {
    const response = await fetch(`/api/restaurants`)
    if (response.ok) {
        const listObj = await response.json()
        const list = listObj.Restaurants
        dispatch(loadRestaurants(list))
    }
}

//Search Restaurants
export const SEARCH_RESTAURANTS = "restaurants/searchedRestaurants";
const search = (restaurants) => ({
    type: SEARCH_RESTAURANTS,
    restaurants
});

export const search_restaurants = (keyword) => async (dispatch) =>{
    const response = await fetch(`/api/restaurants/search/${keyword}`)

    if (response.ok){
      const data = await response.json()
      dispatch(search(data))
      return data
    }
}

// Load a single restaurant
const LOADSINGLE = "singleRestaurant/loadSingleRestaurant"
export const loadSingleRestaurant = (detailObj) => ({
    type: LOADSINGLE,
    singleRestaurant: detailObj
})

export const getSingleRestaurant = (restaurantId) => async dispatch => {
    const response = await fetch(`/api/restaurants/${restaurantId}`)
    if (response.ok) {

        const detailObj = await response.json()
        dispatch(loadSingleRestaurant(detailObj))
    } else {
        console.log("fetch single restaurant failed")
    }
}

//Create a restaurant
const ADD_RESTAURANT ="restaurants/addRestaurants"

export const createRestaurant=(newRestaurant)=>({
    type: ADD_RESTAURANT,
    newRestaurant
})

export const addRestaurantThunk = (newRestaurant) => async dispatch => {
    let createdRestaurantId;
    const response = await fetch("/api/restaurants/", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRestaurant)
    });
    if (response.ok) {
        const createdRestaurant = await response.json()
        createdRestaurantId = createdRestaurant.id
    }
    else {
        console.log("add restaurant failed here")
    }

    if (createdRestaurantId) {

        const previewImage={
            url:newRestaurant.url,
            preview:true
        }

        const responseObj = await fetch(`/api/restaurants/${createdRestaurantId}/images`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(previewImage)
        })

        if (responseObj.ok) {
            return createdRestaurantId
        }
    }

}

//Edit a restaurant
const UPDATE_RESTAURANT = "restaurants/updateRestaurant"
export const updateSingleRestaurant = (restaurant) => ({
    type: UPDATE_RESTAURANT,
    restaurant
})

export const updateRestaurantThunk = (restaurant, user_id) => async dispatch => {
    const { id, user_id, name, price, address, city, state, zipcode, country, phone_number, description,  website } = restaurant
    const res = await fetch(`/api/restaurants/${+id}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id, name, price, address, city, state, zipcode, country, phone_number, description, website
        })
    })

    if (res.ok) {
        const updatedRestaurant = await res.json()
        await dispatch(updateSingleRestaurant(updatedRestaurant))
        dispatch(getSingleRestaurant(updatedRestaurant.id))
        return updatedRestaurant
    }
}


//Delete a restaurant
const DELETE_RESTAURANT = "restaurants/deleteRestaurant"
export const deleteRestaurant = (id) => ({
    type: DELETE_RESTAURANT,
    id
})

export const deleteRestaurantThunk = (id) => async dispatch => {

    const res = await fetch(`/api/restaurants/${id}`, {
        method: "DELETE"
    })
    if (res.ok) {
        await dispatch(deleteRestaurant(id))
        dispatch(getAllRestaurants())
    }
}




const initialState = {};
export default function restaurantsReducer(state = initialState, action) {
    switch (action.type) {
        case LOAD:
            const newAllRestaurants = {}
            action.allRestaurants.forEach(restaurant => {
                newAllRestaurants[restaurant.id] = restaurant
            })
            return {
                ...state,
                allRestaurants: {
                    ...newAllRestaurants
                }
            };
        case LOADSINGLE: {
            const newSingleState = action.singleRestaurant
            return {
                ...state,
                singleRestaurant: {
                    ...state.singleRestaurant,
                    ...newSingleState
                }
            }
        }
        case UPDATE_RESTAURANT: {
            const updateRestaurantState = { ...state }
            updateRestaurantState.singleRestaurant[action.restaurant.id] = action.restaurant
            return updateRestaurantState
        }
        case DELETE_RESTAURANT: {
            const deleteRestaurantState = { ...state }
            delete deleteRestaurantState.singleRestaurant[action.id]
            return deleteRestaurantState
        }
        case SEARCH_RESTAURANTS:
            const newState = { ...state, searchedRestaurants: {} };
            action.restaurants.Restaurants.forEach((restaurant) => {
                newState.searchedRestaurants[restaurant.id] = restaurant;
            });
            return newState;

        default:
            return state;
    }
}
