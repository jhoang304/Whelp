import "./DisplayPhotos.css";
import React, { useEffect, useState } from "react";
import { getRestaurantRestaurantImages, deleteRestaurantImageThunk, setCoverPhotoThunk } from "../../store/restaurantPhoto";
import { useAppDispatch, useAppSelector } from "../../store";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../utils/images";
import { RestaurantImage, SingleRestaurantResponse } from "../../types";
import Lightbox from "../Lightbox";

interface DisplayPhotosProps {
    singleRestaurant: SingleRestaurantResponse;
}

function DisplayPhotos({ singleRestaurant }: DisplayPhotosProps): React.JSX.Element {
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    // Why the photos couldn't be loaded. A dropped connection used to leave
    // "Loading..." up for good (#116).
    const [loadErrors, setLoadErrors] = useState<string[] | null>(null);
    // Bumped by Try again.
    const [attempt, setAttempt] = useState<number>(0);
    // Which photo is enlarged, or null for none.
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [busyPhotoId, setBusyPhotoId] = useState<number | null>(null);
    const sessionUser = useAppSelector((state) => state.session.user);
    const dispatch = useAppDispatch()

    // The API lets the uploader *or* the restaurant owner delete a photo, and
    // only the owner choose the cover. Mirror both rules here.
    const isOwner = !!sessionUser && sessionUser.id === singleRestaurant.user_id;
    const canDelete = (photo: RestaurantImage) =>
        !!sessionUser && (isOwner || photo.createdByUserId === sessionUser.id);

    useEffect(() => {
        let cancelled = false;
        setIsLoaded(false);
        dispatch(getRestaurantRestaurantImages(singleRestaurant.id)).then((errors) => {
            if (cancelled) return;
            setLoadErrors(errors);
            setIsLoaded(true);
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, singleRestaurant.id, attempt]);

    const allResPhotoState = useAppSelector((state) => {
        return state.photos
    })
    // This restaurant's only: the store keeps whichever restaurant's photos
    // were loaded last, and a failed load used to show those (#116).
    const allResPhotoArray: RestaurantImage[] =
        Object.values(allResPhotoState?.allRestaurantImages ?? {})
            .filter((photo) => photo.restaurant_id === singleRestaurant.id)


    // Both handlers clear busyPhotoId in a finally: this modal stays mounted
    // either way, and an unhandled rejection would otherwise leave the button
    // disabled with nothing to explain why.
    const handleSetCover = async (photo: RestaurantImage) => {
        setErrors([]);
        setBusyPhotoId(photo.id);
        try {
            const failures: string[] | null = await dispatch(setCoverPhotoThunk(photo.id, singleRestaurant.id));
            if (failures) setErrors(failures);
        } catch (unexpected) {
            setErrors(["Something went wrong setting the cover photo. Please try again."]);
        } finally {
            setBusyPhotoId(null);
        }
    };

    const handleRemove = async (photo: RestaurantImage) => {
        setErrors([]);
        setBusyPhotoId(photo.id);
        try {
            const failures: string[] | null = await dispatch(deleteRestaurantImageThunk(photo.id, photo.restaurant_id));
            if (failures) {
                setErrors(failures);
                return;
            }
            await dispatch(getRestaurantRestaurantImages(singleRestaurant.id));
        } catch (unexpected) {
            setErrors(["Something went wrong removing the photo. Please try again."]);
        } finally {
            setBusyPhotoId(null);
        }
    };

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    if (loadErrors) {
        return (
            <div className="display-photos-modal">
                <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
                <div className="photo-errors" role="alert">
                    <p>{loadErrors[0]}</p>
                    <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                </div>
            </div>
        );
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
                {allResPhotoArray.map((photo: RestaurantImage, index: number) => {
                    const isDefaultPhoto = photo.url === DEFAULT_RESTAURANT_IMAGE;
                    const isBusy = busyPhotoId === photo.id;
                    const showSetCover = isOwner && !photo.preview && !isDefaultPhoto;
                    const showRemove = canDelete(photo) && !isDefaultPhoto;
                    return (
                        <li className="photo-li" key={photo.id}>
                            <div className="photo-frame">
                                {/* A button, so the keyboard can open it too:
                                    a clickable <img> is a mouse-only control. */}
                                <button
                                    type="button"
                                    className="photo-open"
                                    onClick={() => setOpenIndex(index)}
                                    aria-label={`Enlarge photo ${index + 1} of ${allResPhotoArray.length} of ${singleRestaurant.name}`}
                                >
                                    <img
                                        className="indi-photo"
                                        src={photo.url}
                                        alt=""
                                        onError={onRestaurantImageError}
                                    />
                                </button>
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
            
            {openIndex !== null && (
                <Lightbox
                    photos={allResPhotoArray.map((photo, index) => ({
                        url: photo.url,
                        alt: `${singleRestaurant.name}, ${index + 1} of ${allResPhotoArray.length}`,
                    }))}
                    index={openIndex}
                    onIndexChange={setOpenIndex}
                    onClose={() => setOpenIndex(null)}
                />
            )}
        </div>
    )
}

export default DisplayPhotos