import "./DisplayPhotos.css";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getRestaurantRestaurantImages, deleteRestaurantImageThunk, setCoverPhotoThunk } from "../../store/restaurantPhoto";
import { RootState } from "../../types";
import { AppDispatch } from "../../store";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../utils/images";

interface DisplayPhotosProps {
    singleRestaurant: any;
}

function DisplayPhotos({ singleRestaurant }: DisplayPhotosProps): React.JSX.Element {
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
    const [errors, setErrors] = useState<string[]>([]);
    const [busyPhotoId, setBusyPhotoId] = useState<number | null>(null);
    const sessionUser = useSelector((state: RootState) => state.session.user);
    const dispatch = useDispatch<AppDispatch>()

    // The API lets the uploader *or* the restaurant owner delete a photo, and
    // only the owner choose the cover. Mirror both rules here.
    const isOwner = !!sessionUser && sessionUser.id === singleRestaurant.user_id;
    const canDelete = (photo: any) =>
        !!sessionUser && (isOwner || photo.createdByUserId === sessionUser.id);

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

    // Both handlers clear busyPhotoId in a finally: this modal stays mounted
    // either way, and an unhandled rejection would otherwise leave the button
    // disabled with nothing to explain why.
    const handleSetCover = async (photo: any) => {
        setErrors([]);
        setBusyPhotoId(photo.id);
        try {
            const failures: string[] | null = await dispatch(setCoverPhotoThunk(photo.id, singleRestaurant.id) as any);
            if (failures) setErrors(failures);
        } catch (unexpected) {
            setErrors(["Something went wrong setting the cover photo. Please try again."]);
        } finally {
            setBusyPhotoId(null);
        }
    };

    const handleRemove = async (photo: any) => {
        setErrors([]);
        setBusyPhotoId(photo.id);
        try {
            const failures: string[] | null = await dispatch(deleteRestaurantImageThunk(photo.id, photo.restaurant_id) as any);
            if (failures) {
                setErrors(failures);
                return;
            }
            await dispatch(getRestaurantRestaurantImages(singleRestaurant.id) as any);
        } catch (unexpected) {
            setErrors(["Something went wrong removing the photo. Please try again."]);
        } finally {
            setBusyPhotoId(null);
        }
    };

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return (
        <div className="display-photos-modal">
            <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
            {errors.length > 0 && (
                <ul className="photo-errors">
                    {errors.map((error, idx) => <li key={idx}>{error}</li>)}
                </ul>
            )}
            <ul className="photo-container">
                {allResPhotoArray.map((photo: any, index: number) => {
                    const isDefaultPhoto = photo.url === DEFAULT_RESTAURANT_IMAGE;
                    const isBusy = busyPhotoId === photo.id;
                    const showSetCover = isOwner && !photo.preview && !isDefaultPhoto;
                    const showRemove = canDelete(photo) && !isDefaultPhoto;
                    return (
                        <li className="photo-li" key={photo.id}>
                            <div className="photo-frame">
                                <img
                                    className="indi-photo"
                                    src={photo.url}
                                    alt="res-photos"
                                    onClick={() => openPhoto(photo.url, index)}
                                    onError={onRestaurantImageError}
                                />
                                {photo.preview && (
                                    <span className="cover-badge">
                                        <i className="fa-solid fa-star"></i>
                                        Cover photo
                                    </span>
                                )}
                            </div>
                            {showSetCover || showRemove ? (
                                <div className="photo-actions">
                                    {showSetCover && (
                                        <button
                                            className="set-cover-photo"
                                            disabled={isBusy}
                                            onClick={() => handleSetCover(photo)}
                                        >
                                            <i className="fa-regular fa-star"></i>
                                            Set as cover
                                        </button>
                                    )}
                                    {showRemove && (
                                        <button
                                            className="delete-photo"
                                            disabled={isBusy}
                                            onClick={() => handleRemove(photo)}
                                        >
                                            <i className="fa-regular fa-trash-can"></i>
                                            Remove Photo
                                        </button>
                                    )}
                                </div>
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
                            alt={`${singleRestaurant.name}, enlarged`}
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