import { getSingleRestaurant } from "./restaurants";
import { AnyAction } from "redux";

import { PhotosState, RestaurantImage } from "../types";
import { AppDispatch } from "./index";
import { parseErrors } from "../utils/parseErrors";

export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

//load photos
const LOADPHOTO = "photos/loadRestaurantImages"
export const loadRestaurantImages = (list: RestaurantImage[]) => ({
    type: LOADPHOTO,
    allRestaurantImages: list
})

export const getRestaurantRestaurantImages = (restaurantId: string | number) => async (dispatch: AppDispatch) => {
    const response = await fetch(`/api/restaurant-images/${restaurantId}/images`)
    if (response.ok) {
        const listObj = await response.json()
        dispatch(loadRestaurantImages(listObj))
    }
}


//Add a photo
export const addRestaurantImage = (newRestaurantImage: { url: string; preview?: boolean }, restaurantId: string | number) => async (dispatch: AppDispatch) => {
    let response: Response
    try {
        response = await fetch(`/api/restaurants/${restaurantId}/images`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newRestaurantImage)
        });
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if (response.ok) {
        dispatch(getSingleRestaurant(+restaurantId))
        return null
    }
    // Return a list of messages so the modal can show them.
    return parseErrors(response, "Could not add the photo. Please try again.")
}

//Make an existing photo the restaurant's cover
/**
 * Promote one photo to the restaurant's cover. Owner-only server side; the
 * API clears `preview` on the restaurant's other photos in the same
 * transaction, so the listing is refetched rather than patched here.
 * Returns null on success or a list of error messages.
 */
export const setCoverPhotoThunk = (photoId: string | number, restaurantId: string | number) => async (dispatch: AppDispatch) => {
    let res: Response
    try {
        res = await fetch(`/api/restaurant-images/${photoId}/cover`, {
            method: "PUT"
        })
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if (res.ok) {
        await dispatch(getRestaurantRestaurantImages(restaurantId))
        dispatch(getSingleRestaurant(+restaurantId))
        return null
    }
    return parseErrors(res, "Could not set the cover photo. Please try again.")
}

//Delete a photo
const DELETE_PHOTO = "photos/deleteRestaurantImage"
export const deleteRestaurantImage = (photoId: string | number) => ({
    type: DELETE_PHOTO,
    photoId
})


/**
 * Remove a photo. Returns null on success or a list of error messages: the
 * API's 403 ("only the uploader or the business owner") and 404 used to be
 * dropped on the floor, so a refused delete looked like nothing happened.
 */
export const deleteRestaurantImageThunk = (photoId: string | number, restaurantId: string | number) => async (dispatch: AppDispatch) => {
    let res: Response
    try {
        res = await fetch(`/api/restaurant-images/${photoId}`, {
            method: "DELETE"
        })
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if (res.ok) {
        await dispatch(deleteRestaurantImage(photoId))
        dispatch(getSingleRestaurant(+restaurantId))
        return null
    }
    return parseErrors(res, "Could not remove the photo. Please try again.")
}


const initialState = {}

export default function photoReducer(state: PhotosState = initialState, action: AnyAction): PhotosState {
    switch (action.type) {
        case LOADPHOTO:
            const newRestaurantImages: { [key: string]: RestaurantImage } = {}
            action.allRestaurantImages.forEach((photo: RestaurantImage) => {
                newRestaurantImages[photo.id] = photo
            })
            return {
                ...state,
                allRestaurantImages: {
                    ...newRestaurantImages
                }
            };
        case DELETE_PHOTO: {
            // The images may not have been loaded into the store at all, in
            // which case there is nothing to remove -- indexing through the
            // undefined was a crash waiting for the right order of events.
            if (!state.allRestaurantImages) return state
            const remaining = { ...state.allRestaurantImages }
            delete remaining[action.photoId]
            return { ...state, allRestaurantImages: remaining }
        }
        default:
            return state
    }
}
