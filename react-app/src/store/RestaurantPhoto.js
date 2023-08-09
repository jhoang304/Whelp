import { getSingleRestaurant } from "./restaurants";

//load photos
const LOADPHOTO = "photos/loadPhotos"
export const loadPhotos = (list) => ({
    type: LOADPHOTO,
    allPhotos: list
})

export const getRestaurantPhotos = (restaurantId) => async dispatch => {
    const response = await fetch(`/api/restaurant-images/${restaurantId}/images`)
    if (response.ok) {
        const listObj = await response.json()
        dispatch(loadPhotos(listObj))
    }
}


//Add a photo
const ADD_PHOTO = "photos/addPhoto"
export const createPhoto = (createdPhoto) => ({
    type: ADD_PHOTO,
    id: createdPhoto.id,
    createdPhoto

})
export const addPhoto = (newPhoto, restaurantId) => async dispatch => {
    const response = await fetch(`/api/restaurants/${restaurantId}/images`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPhoto)
    });
    if (response.ok) {
        const createdPhoto = await response.json()
        await dispatch(createPhoto(createdPhoto))
        dispatch(getSingleRestaurant(restaurantId))
    }
}

//Delete a photo
const DELETE_PHOTO = "photos/deletePhoto"
export const deletePhoto = (photoId) => ({
    type: DELETE_PHOTO,
    photoId
})


export const deletePhotoThunk = (photoId, restaurantId) => async dispatch => {

    const res = await fetch(`/api/restaurant-images/${photoId}`, {
        method: "DELETE"
    })
    if (res.ok) {
        await dispatch(deletePhoto(photoId))
        dispatch(getSingleRestaurant(restaurantId))
    }
}


const initialState = {}

export default function photoReducer(state = initialState, action) {
    switch (action.type) {
        case LOADPHOTO:
            const newPhotos = {}
            action.allPhotos.forEach(photo => {
                newPhotos[photo.id] = photo
            })
            return {
                ...state,
                allPhotos: {
                    ...newPhotos
                }
            };
        case DELETE_PHOTO: {
            const deletePhotoState = { ...state }
            delete deletePhotoState.allPhotos[action.photoId]
            return deletePhotoState
        }
        default:
            return state
    }
}
