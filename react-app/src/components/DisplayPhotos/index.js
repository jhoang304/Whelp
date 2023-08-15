import "./DisplayPhotos.css";
import { useDispatch, useSelector } from "react-redux";
import { getRestaurantPhotos, deletePhotoThunk } from "../../store/restaurantPhoto";
import { useEffect } from "react";
import { useState } from "react";


function DisplayPhotos({ singleRestaurant }) {

    const [isLoaded, setIsLoaded] = useState(false);
    const sessionUser = useSelector(state => state.session.user);
    const dispatch = useDispatch()

    useEffect(() => {
        async function fetchData() {
            await dispatch(getRestaurantPhotos(singleRestaurant.id));
            setIsLoaded(true);
        }
        fetchData();
    }, [dispatch, singleRestaurant.id]);


    const allResPhotoState = useSelector((state) => {
        return state.photos
    })
    let allResPhotoObj;
    if (allResPhotoState) {
        allResPhotoObj = allResPhotoState.allPhotos
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
                    {allResPhotoArray.map(photo => {
                        const isDefaultPhoto = photo.url === "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png";
                        return (
                            <li className="photo-li">
                                <img className="indi-photo" src={photo.url} alt="res-photos" onError={e => {e.currentTarget.src = "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png"}}></img>
                                {sessionUser && photo.createdByUserId === sessionUser.id ? (
                                    <button
                                        className="delete-photo"
                                        onClick={async () => {
                                            if (!isDefaultPhoto) {
                                                await dispatch(deletePhotoThunk(photo.id, photo.restaurant_id));
                                                getRestaurantPhotos()
                                            }
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

export default DisplayPhotos
