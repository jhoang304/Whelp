import "./DisplayPhotos.css";
import { useDispatch, useSelector } from "react-redux";
import { getRestaurantPhotos, deletePhotoThunk } from "../../store/RestaurantPhoto";
import { useEffect } from "react";
import { useState } from "react";
import { useModal } from "../../context/Modal";


export default function DisplayPhotos({ singleRestaurant }) {

    const { closeModal } = useModal()
    const [isLoaded, setIsLoaded] = useState(false);
    const sessionUser = useSelector(state => state.session.user);
    const dispatch = useDispatch()
    useEffect(async () => {
        await dispatch(getRestaurantPhotos(singleRestaurant.id))
        setIsLoaded(true)
    }, [dispatch])


    const allResPhotoState = useSelector((state) => state.Restaurants.singleRestaurant.restaurantImages);
    let allResPhotoObj;
    if (allResPhotoState) {
        allResPhotoObj = allResPhotoState
    }

    let allResPhotoArray;
    if (allResPhotoObj) {
        allResPhotoArray = Object.values(allResPhotoObj)
    }


    return (
        isLoaded && (
            <>
                <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
                <ul className="photo-container">
                    {allResPhotoArray && allResPhotoArray.map(photo => {
                        console.log("photos:", photo)
                        return (
                            <li className="photo-li">
                                <img className="indi-photo" src={photo.url}></img>
                                {sessionUser && +photo.createdByUserId === +sessionUser.id ? (
                                    <button
                                        className="delete-photo"
                                        onClick={async () => {
                                            await dispatch(deletePhotoThunk(photo.id, photo.restaurant_id));
                                            getRestaurantPhotos()
                                        }}
                                    >
                                        <i class="fa-regular fa-trash-can"></i>
                                        Remove Photo</button>
                                ):(
                                    <div className="empty-holder"></div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </>
        )
    )
}
