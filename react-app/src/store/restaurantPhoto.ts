import { getSingleRestaurant } from "./restaurants";
import { RestaurantImage } from "../types";
import { AppDispatch } from "./index";

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
const ADD_PHOTO = "photos/addRestaurantImage"
export const createRestaurantImage = (createdRestaurantImage: RestaurantImage) => ({
    type: ADD_PHOTO,
    id: createdRestaurantImage.id,
    createdRestaurantImage

})
export const addRestaurantImage = (newRestaurantImage: any, restaurantId: string | number) => async (dispatch: AppDispatch) => {
    const response = await fetch(`/api/restaurants/${restaurantId}/images`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRestaurantImage)
    });
    if (response.ok) {
        const createdRestaurantImage = await response.json()
        await dispatch(createRestaurantImage(createdRestaurantImage))
        dispatch(getSingleRestaurant(+restaurantId) as any)
        return null
    }
    // Return a list of messages so the modal can show them.
    const data = await response.json().catch(() => ({}))
    if (Array.isArray(data.errors)) return data.errors as string[]
    return ["Could not add the photo. Please try again."]
}

//Make an existing photo the restaurant's cover
/**
 * Promote one photo to the restaurant's cover. Owner-only server side; the
 * API clears `preview` on the restaurant's other photos in the same
 * transaction, so the listing is refetched rather than patched here.
 * Returns null on success or a list of error messages.
 */
export const setCoverPhotoThunk = (photoId: string | number, restaurantId: string | number) => async (dispatch: AppDispatch) => {
    const res = await fetch(`/api/restaurant-images/${photoId}/cover`, {
        method: "PUT"
    })
    if (res.ok) {
        await dispatch(getRestaurantRestaurantImages(restaurantId))
        dispatch(getSingleRestaurant(+restaurantId) as any)
        return null
    }
    const data = await res.json().catch(() => ({}))
    if (Array.isArray(data.errors)) return data.errors as string[]
    return ["Could not set the cover photo. Please try again."]
}

//Delete a photo
const DELETE_PHOTO = "photos/deleteRestaurantImage"
export const deleteRestaurantImage = (photoId: string | number) => ({
    type: DELETE_PHOTO,
    photoId
})


export const deleteRestaurantImageThunk = (photoId: string | number, restaurantId: string | number) => async (dispatch: AppDispatch) => {

    const res = await fetch(`/api/restaurant-images/${photoId}`, {
        method: "DELETE"
    })
    if (res.ok) {
        await dispatch(deleteRestaurantImage(photoId))
        dispatch(getSingleRestaurant(+restaurantId) as any)
    }
}


const initialState = {}

export default function photoReducer(state: any = initialState, action: any): any {
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
            const deleteRestaurantImageState = { ...state }
            delete deleteRestaurantImageState.allRestaurantImages[action.photoId]
            return deleteRestaurantImageState
        }
        default:
            return state
    }
}
