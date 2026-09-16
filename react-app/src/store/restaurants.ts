
import { 
    RestaurantsState, 
    RestaurantActionTypes, 
    Restaurant, 
    RestaurantsResponse
} from '../types';
import { AppDispatch } from './index';

//Load all restaurants
const LOAD = "restaurants/loadRestaurants";

export const loadRestaurants = (list: Restaurant[]) => ({
    type: LOAD,
    allRestaurants: list
});

export const getAllRestaurants = () => async (dispatch: AppDispatch) => {
    const response = await fetch(`/api/restaurants`);
    if (response.ok) {
        const listObj: RestaurantsResponse = await response.json();
        const list = listObj.Restaurants;
        dispatch(loadRestaurants(list));
    }
};

//Search Restaurants
export const SEARCH_RESTAURANTS = "restaurants/searchedRestaurants";
export const SEARCH_RESTAURANTS_LOADING = "restaurants/searchLoading";
export const SEARCH_RESTAURANTS_ERROR = "restaurants/searchError";
export const CLEAR_SEARCH_RESULTS = "restaurants/clearSearchResults";

const searchLoading = () => ({
    type: SEARCH_RESTAURANTS_LOADING
});

const searchError = (error: string) => ({
    type: SEARCH_RESTAURANTS_ERROR,
    error
});

const search = (restaurants: RestaurantsResponse) => ({
    type: SEARCH_RESTAURANTS,
    restaurants
});

const clearSearchResults = () => ({
    type: CLEAR_SEARCH_RESULTS
});

export const search_restaurants = (keyword: string) => async (dispatch: AppDispatch) => {
    if (!keyword || keyword.trim().length === 0) {
        dispatch(searchError("Search keyword cannot be empty"));
        return null;
    }

    dispatch(searchLoading());

    try {
        const response = await fetch(`/api/restaurants/search/${encodeURIComponent(keyword.trim())}`);
        
        if (response.ok) {
            const data = await response.json();
            dispatch(search(data));
            return data;
        } else if (response.status === 400) {
            dispatch(searchError("Invalid search query"));
            return null;
        } else {
            dispatch(searchError("Search failed. Please try again."));
            return null;
        }
    } catch (error) {
        console.error('Search request failed:', error);
        dispatch(searchError("Network error. Please check your connection."));
        return null;
    }
};

export const clearSearch = () => (dispatch: AppDispatch) => {
    dispatch(clearSearchResults());
};

// Load a single restaurant
const LOADSINGLE = "singleRestaurant/loadSingleRestaurant"
const CLEARSINGLE = "singleRestaurant/clearSingleRestaurant"
export const loadSingleRestaurant = (detailObj: any) => ({
    type: LOADSINGLE,
    singleRestaurant: detailObj
})

export const clearSingleRestaurant = () => ({
    type: CLEARSINGLE
})

// The restaurant the detail page most recently asked for. There is one
// shared `singleRestaurant` in the store, so navigating between two detail
// URLs can leave both requests in flight; a slow response for the restaurant
// we have already navigated away from must not write to the store. Requests
// for the same restaurant (the page and its children both ask on load) carry
// the same data, so they are left alone.
let latestRequestedId: number | null = null

/**
 * Load one restaurant's detail page. Returns null on success or a list of
 * error messages on failure, so the page can tell "not found" apart from
 * "still loading" instead of spinning forever.
 */
export const getSingleRestaurant = (restaurantId: number) => async (dispatch: any) => {
    latestRequestedId = restaurantId

    const superseded = () => latestRequestedId !== restaurantId

    const fail = (messages: string[]) => {
        if (superseded()) return null
        // Drop whatever restaurant was showing before; LOADSINGLE merges, so a
        // stale one would otherwise bleed into the not-found page.
        dispatch(clearSingleRestaurant())
        return messages
    }

    let response: Response
    try {
        response = await fetch(`/api/restaurants/${restaurantId}`)
    } catch (networkError) {
        // fetch rejects, rather than resolving with a status, when the browser
        // is offline or the connection drops. Without this the promise the page
        // is awaiting would reject and it would spin forever.
        return fail(["Couldn't reach the server. Check your connection and try again."])
    }

    if (!response.ok) {
        return fail(response.status === 404
            ? ["We couldn't find that restaurant."]
            : ["Something went wrong loading this restaurant."])
    }

    let detail: any
    try {
        detail = await response.json()
    } catch (parseError) {
        return fail(["Something went wrong loading this restaurant."])
    }

    if (superseded()) return null
    dispatch(loadSingleRestaurant(detail))
    return null
}

//Create a restaurant
const ADD_RESTAURANT ="restaurants/addRestaurants"

export const createRestaurant=(newRestaurant: any)=>({
    type: ADD_RESTAURANT,
    newRestaurant
})

export const addRestaurantThunk = (newRestaurant: any) => async (dispatch: any) => {
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
        // Callers (CreateRestaurantModal) read the JSON errors off the thrown response.
        throw response
    }

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

    if (!responseObj.ok) {
        throw responseObj
    }

    return createdRestaurantId
}

//Edit a restaurant
const UPDATE_RESTAURANT = "restaurants/updateRestaurant"
export const updateSingleRestaurant = (restaurant: any) => ({
    type: UPDATE_RESTAURANT,
    restaurant
})

/**
 * Save an edited restaurant. Returns null on success or a list of error
 * messages, the contract createReviewResponse uses, so the modal can show
 * what went wrong instead of closing over a failed PUT.
 */
export const updateRestaurantThunk = (restaurant: any) => async (dispatch: any) => {
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
        await dispatch(getSingleRestaurant(updatedRestaurant.id))
        return null
    }

    const data = await res.json().catch(() => ({}))
    if (Array.isArray(data.errors)) return data.errors as string[]
    // Older shape: WTForms' {field: [messages]} dict.
    if (data.errors && typeof data.errors === 'object') {
        return Object.values(data.errors).flat() as string[]
    }
    return ["Could not save your changes. Please try again."]
}


//Delete a restaurant
const DELETE_RESTAURANT = "restaurants/deleteRestaurant"
export const deleteRestaurant = (id: number) => ({
    type: DELETE_RESTAURANT,
    id
})

export const deleteRestaurantThunk = (id: number) => async (dispatch: any) => {

    const res = await fetch(`/api/restaurants/${id}`, {
        method: "DELETE"
    })
    if (res.ok) {
        await dispatch(deleteRestaurant(id))
        dispatch(getAllRestaurants())
    }
}




const initialState: RestaurantsState = {};

export default function restaurantsReducer(
    state: RestaurantsState = initialState, 
    action: RestaurantActionTypes
): RestaurantsState {
    switch (action.type) {
        case LOAD:
            const newAllRestaurants: { [key: number]: Restaurant } = {};
            action.allRestaurants.forEach(restaurant => {
                newAllRestaurants[restaurant.id] = restaurant;
            });
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
        case CLEARSINGLE: {
            return {
                ...state,
                singleRestaurant: undefined
            }
        }
        case UPDATE_RESTAURANT: {
            const updateRestaurantState = { ...state }
            if (updateRestaurantState.singleRestaurant) {
                (updateRestaurantState.singleRestaurant as any)[action.restaurant.id] = action.restaurant
            }
            return updateRestaurantState
        }
        case DELETE_RESTAURANT: {
            const deleteRestaurantState = { ...state }
            if (deleteRestaurantState.singleRestaurant) {
                delete (deleteRestaurantState.singleRestaurant as any)[action.id]
            }
            return deleteRestaurantState
        }
        case SEARCH_RESTAURANTS_LOADING:
            return {
                ...state,
                searchLoading: true,
                searchError: null
            };
        case SEARCH_RESTAURANTS_ERROR:
            return {
                ...state,
                searchLoading: false,
                searchError: action.error,
                searchedRestaurants: {}
            };
        case SEARCH_RESTAURANTS:
            const newState = { 
                ...state, 
                searchedRestaurants: {},
                searchLoading: false,
                searchError: null
            };
            action.restaurants.Restaurants.forEach((restaurant) => {
                (newState.searchedRestaurants as any)[restaurant.id] = restaurant;
            });
            return newState;
        case CLEAR_SEARCH_RESULTS:
            return {
                ...state,
                searchedRestaurants: {},
                searchLoading: false,
                searchError: null
            };

        default:
            return state;
    }
}
