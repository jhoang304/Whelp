
import {
    OpeningHours,
    RestaurantsState,
    RestaurantActionTypes,
    Restaurant,
    RestaurantsResponse,
    SingleRestaurantResponse
} from '../types';
import { AppDispatch } from './index';
import { parseErrors } from '../utils/parseErrors';
import { NO_FILTERS, RestaurantFilters, filterParams } from '../utils/filters';
import { FAVORITE_CHANGED } from './favorites';

/** The same map with one restaurant's flag changed, if it is in there. */
const withFlag = (
    map: { [key: number]: Restaurant } | undefined, id: number, isFavorited: boolean,
) => (map && map[id] ? { ...map, [id]: { ...map[id], isFavorited } } : map);

/** What the create and edit modals send. The API owns id and user_id. */
export interface RestaurantDraft {
    name: string;
    price: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    phone_number: string;
    website: string;
    description: string;
    /** create only: the cover photo, uploaded or pasted */
    url?: string;
    /** omitted leaves a restaurant's cuisines alone; [] clears them */
    category_ids?: number[];
    amenity_ids?: number[];
    /** the days it opens; a day left out is a day it is closed */
    hours?: OpeningHours[];
    timezone?: string | null;
    id?: number;
    user_id?: number;
}

//Load all restaurants
const LOAD = "restaurants/loadRestaurants";

export const loadRestaurants = (page: RestaurantsResponse, append: boolean) => ({
    type: LOAD,
    allRestaurants: page.items,
    total: page.total,
    page: page.page,
    append
});

export const PER_PAGE = 20;

export const LOAD_ERROR = "restaurants/loadError";

const loadError = (error: string) => ({
    type: LOAD_ERROR,
    error
});

/**
 * Load one page of restaurants, narrowed by `filters`. `append` keeps what is
 * already in the store, which is what the listing's "Show more" wants;
 * without it a second page would replace the first.
 *
 * A refused filter is kept as a message rather than swallowed: an empty
 * listing and a rejected one look identical otherwise, and only one of them
 * is worth clearing the filters over.
 */
export const getAllRestaurants = (
    page = 1,
    filters: RestaurantFilters = NO_FILTERS,
) => async (dispatch: AppDispatch) => {
    const params = filterParams(filters);
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));

    // With the trailing slash: without it every listing costs a 308 to the
    // rule that has one, and then the request again.
    const response = await fetch(`/api/restaurants/?${params.toString()}`);
    if (response.ok) {
        const body: RestaurantsResponse = await response.json();
        dispatch(loadRestaurants(body, page > 1));
        return body;
    }
    const messages = await parseErrors(response, "Something went wrong loading restaurants.");
    dispatch(loadError(messages[0]));
    return null;
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

const search = (restaurants: RestaurantsResponse, append: boolean) => ({
    type: SEARCH_RESTAURANTS,
    restaurants,
    append
});

const clearSearchResults = () => ({
    type: CLEAR_SEARCH_RESULTS
});

export const search_restaurants = (
    keyword: string,
    page = 1,
    filters: RestaurantFilters = NO_FILTERS,
) => async (dispatch: AppDispatch) => {
    if (!keyword || keyword.trim().length === 0) {
        dispatch(searchError("Search keyword cannot be empty"));
        return null;
    }

    dispatch(searchLoading());

    const params = filterParams(filters);
    params.set("page", String(page));
    params.set("per_page", String(PER_PAGE));

    try {
        const response = await fetch(
            `/api/restaurants/search/${encodeURIComponent(keyword.trim())}`
            + `?${params.toString()}`);

        if (response.ok) {
            const data = await response.json();
            dispatch(search(data, page > 1));
            return data;
        } else if (response.status === 400) {
            // The API says which filter it disliked; "Invalid search query"
            // sent someone hunting through their keyword for the problem.
            const messages = await parseErrors(response, "Invalid search query");
            dispatch(searchError(messages[0]));
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
export const loadSingleRestaurant = (detailObj: SingleRestaurantResponse) => ({
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
export const getSingleRestaurant = (restaurantId: number) => async (dispatch: AppDispatch) => {
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

    let detail: SingleRestaurantResponse
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
export const addRestaurantThunk = (newRestaurant: RestaurantDraft) => async () => {
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
/**
 * Save an edited restaurant. Returns null on success or a list of error
 * messages, the contract createReviewResponse uses, so the modal can show
 * what went wrong instead of closing over a failed PUT.
 */
export const updateRestaurantThunk = (restaurant: RestaurantDraft & { id: number }) => async (dispatch: AppDispatch) => {
    const { id, user_id, name, price, address, city, state, zipcode, country, phone_number,
        description, website, category_ids, amenity_ids, hours, timezone } = restaurant

    let res: Response
    try {
        res = await fetch(`/api/restaurants/${+id}`, {
            method: "PUT",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id, name, price, address, city, state, zipcode, country, phone_number,
                description, website, category_ids, amenity_ids, hours, timezone
            })
        })
    } catch (networkError) {
        // fetch rejects, rather than resolving with a status, when the browser
        // is offline or the connection drops. Returning the message keeps this
        // thunk's "null or messages" contract, so the modal can recover.
        return ["Couldn't reach the server. Check your connection and try again."]
    }

    if (res.ok) {
        const updatedRestaurant = await res.json()
        await dispatch(getSingleRestaurant(updatedRestaurant.id))
        return null
    }

    return parseErrors(res, "Could not save your changes. Please try again.")
}


//Delete a restaurant
export const deleteRestaurantThunk = (id: number) => async (dispatch: AppDispatch) => {

    const res = await fetch(`/api/restaurants/${id}`, {
        method: "DELETE"
    })
    if (res.ok) {
        dispatch(getAllRestaurants())
    }
}




const initialState: RestaurantsState = {};

export default function restaurantsReducer(
    state: RestaurantsState = initialState, 
    action: RestaurantActionTypes
): RestaurantsState {
    switch (action.type) {
        case LOAD: {
            const loaded: { [key: number]: Restaurant } = action.append
                ? { ...state.allRestaurants }
                : {};
            action.allRestaurants.forEach(restaurant => {
                loaded[restaurant.id] = restaurant;
            });
            return {
                ...state,
                allRestaurants: loaded,
                totalRestaurants: action.total,
                loadedPage: action.page,
                listError: null
            };
        }
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
        case SEARCH_RESTAURANTS: {
            const found: { [key: number]: Restaurant } = action.append
                ? { ...state.searchedRestaurants }
                : {};
            action.restaurants.items.forEach((restaurant) => {
                found[restaurant.id] = restaurant;
            });
            return {
                ...state,
                searchedRestaurants: found,
                totalSearched: action.restaurants.total,
                searchedPage: action.restaurants.page,
                searchLoading: false,
                searchError: null
            };
        }
        case LOAD_ERROR:
            return {
                ...state,
                listError: action.error
            };
        case CLEAR_SEARCH_RESULTS:
            return {
                ...state,
                searchedRestaurants: {},
                searchLoading: false,
                searchError: null
            };
        case FAVORITE_CHANGED: {
            const { restaurantId, isFavorited } = action;
            return {
                ...state,
                allRestaurants: withFlag(state.allRestaurants, restaurantId, isFavorited),
                searchedRestaurants: withFlag(state.searchedRestaurants, restaurantId, isFavorited),
                singleRestaurant: state.singleRestaurant && state.singleRestaurant.id === restaurantId
                    ? { ...state.singleRestaurant, isFavorited }
                    : state.singleRestaurant,
            };
        }

        default:
            return state;
    }
}
