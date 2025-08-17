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
    }
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
