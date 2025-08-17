import "./DisplayPhotos.css";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getRestaurantRestaurantImages, deleteRestaurantImageThunk } from "../../store/restaurantPhoto";
import { RootState } from "../../types";
import { AppDispatch } from "../../store";

interface DisplayPhotosProps {
    singleRestaurant: any;
}

function DisplayPhotos({ singleRestaurant }: DisplayPhotosProps): React.JSX.Element {
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const sessionUser = useSelector((state: RootState) => state.session.user);
    const dispatch = useDispatch<AppDispatch>()

    useEffect(() => {
        async function fetchData() {
            await dispatch(getRestaurantRestaurantImages(singleRestaurant.id) as any);
            setIsLoaded(true);
        }
        fetchData();
    }, [dispatch, singleRestaurant.id]);

    const allResPhotoState = useSelector((state: RootState) => {
        return state.photos
    })
    let allResPhotoObj: any;
    if (allResPhotoState) {
        allResPhotoObj = (allResPhotoState as any).allRestaurantImages
    }

    let allResPhotoArray: any[] = [];
    if (allResPhotoObj) {
        allResPhotoArray = Object.values(allResPhotoObj)
    }

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
            <ul className="photo-container">
                {allResPhotoArray.map((photo: any) => {
                    const isDefaultPhoto = photo.url === "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png";
                    return (
                        <li className="photo-li" key={photo.id}>
                            <img className="indi-photo" src={photo.url} alt="res-photos" onError={e => {(e.target as HTMLImageElement).src = "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png"}}></img>
                            {sessionUser && photo.createdByUserId === sessionUser.id ? (
                                <button
                                    className="delete-photo"
                                    onClick={async () => {
                                        if (!isDefaultPhoto) {
                                            await dispatch(deleteRestaurantImageThunk(photo.id, photo.restaurant_id) as any);
                                            dispatch(getRestaurantRestaurantImages(singleRestaurant.id) as any);
                                        }
                                    }}
                                >
                                    <i className="fa-regular fa-trash-can"></i>
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
}

export default DisplayPhotos