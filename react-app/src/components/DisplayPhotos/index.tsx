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
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
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

    const navigatePhoto = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            const newIndex = currentPhotoIndex === 0 ? allResPhotoArray.length - 1 : currentPhotoIndex - 1;
            setCurrentPhotoIndex(newIndex);
            setSelectedPhoto(allResPhotoArray[newIndex].url);
        } else {
            const newIndex = currentPhotoIndex === allResPhotoArray.length - 1 ? 0 : currentPhotoIndex + 1;
            setCurrentPhotoIndex(newIndex);
            setSelectedPhoto(allResPhotoArray[newIndex].url);
        }
    };

    const openPhoto = (photoUrl: string, index: number) => {
        setSelectedPhoto(photoUrl);
        setCurrentPhotoIndex(index);
    };

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <div className="display-photos-modal">
            <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
            <ul className="photo-container">
                {allResPhotoArray.map((photo: any, index: number) => {
                    const isDefaultPhoto = photo.url === "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png";
                    return (
                        <li className="photo-li" key={photo.id}>
                            <img 
                                className="indi-photo" 
                                src={photo.url} 
                                alt="res-photos" 
                                onClick={() => openPhoto(photo.url, index)}
                                onError={e => {(e.target as HTMLImageElement).src = "https://cdn.discordapp.com/attachments/320286625521336341/1141137960859881482/default_whelp_picture.png"}}
                            />
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
                                    Remove Photo
                                </button>
                            ):(
                                <div className="empty-holder"></div>
                            )}
                        </li>
                    )
                })}
            </ul>
            
            {selectedPhoto && (
                <div className="image-viewer-overlay" onClick={() => setSelectedPhoto(null)}>
                    <div className="image-viewer-container">
                        <button 
                            className="image-viewer-close" 
                            onClick={() => setSelectedPhoto(null)}
                            aria-label="Close image viewer"
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                        
                        {allResPhotoArray.length > 1 && (
                            <button 
                                className="image-nav-arrow image-nav-prev" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigatePhoto('prev');
                                }}
                                aria-label="Previous photo"
                            >
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                        )}
                        
                        <img 
                            className="image-viewer-photo" 
                            src={selectedPhoto} 
                            alt="Enlarged restaurant photo"
                            onClick={(e) => e.stopPropagation()}
                        />
                        
                        {allResPhotoArray.length > 1 && (
                            <button 
                                className="image-nav-arrow image-nav-next" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigatePhoto('next');
                                }}
                                aria-label="Next photo"
                            >
                                <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        )}
                        
                        <div className="image-counter">
                            {currentPhotoIndex + 1} / {allResPhotoArray.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default DisplayPhotos