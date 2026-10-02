import "./DisplayPhotos.css";
import React, { useEffect, useRef, useState } from "react";
import { getRestaurantRestaurantImages, deleteRestaurantImageThunk, setCoverPhotoThunk } from "../../store/restaurantPhoto";
import { useAppDispatch, useAppSelector } from "../../store";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../utils/images";
import { RestaurantImage, SingleRestaurantResponse } from "../../types";
import Lightbox from "../Lightbox";
import FormErrors from "../FormErrors";
import ModalCloseButton from "../ModalCloseButton";
import InlineConfirm from "../InlineConfirm";
import { useFocusAfterRender } from "../../hooks/useFocusAfterRender";

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
    // The photo whose Remove is asking "Remove this photo?" (#131). It used
    // to delete on the first click, for good, and an owner can remove photos
    // other people added.
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    // "Photo removed.", for a screen reader: the card just goes.
    const [removedNote, setRemovedNote] = useState<string>("");
    const modalRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const focusLater = useFocusAfterRender();
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

    const askToRemove = (photo: RestaurantImage) => {
        setRemovedNote("");
        setConfirmingId(photo.id);
    };

    // Asked and answered. A refusal leaves the question up, to try again.
    const handleRemove = async (photo: RestaurantImage, index: number) => {
        setErrors([]);
        setBusyPhotoId(photo.id);
        try {
            const failures: string[] | null = await dispatch(deleteRestaurantImageThunk(photo.id, photo.restaurant_id));
            if (failures) {
                setErrors(failures);
                return;
            }
            setConfirmingId(null);
            setRemovedNote("Photo removed.");
            await dispatch(getRestaurantRestaurantImages(singleRestaurant.id));
            // On to the photo that took its place, or the one before it if
            // it was the last; with none left, the modal's close button.
            focusLater(() => {
                const photos = listRef.current?.querySelectorAll<HTMLElement>(".photo-open");
                return (photos && photos[Math.min(index, photos.length - 1)])
                    || modalRef.current?.querySelector<HTMLElement>("button");
            });
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
                <ModalCloseButton label="Close photos" />
                <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
                <div className="photo-errors" role="alert">
                    <p>{loadErrors[0]}</p>
                    <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="display-photos-modal" ref={modalRef}>
            <ModalCloseButton label="Close photos" />
            <h2 className="display-h2">Photos for {singleRestaurant.name}</h2>
            <FormErrors errors={errors} className="photo-errors" />
            <p className="visually-hidden" role="status">{removedNote}</p>
            <ul className="photo-container" ref={listRef}>
                {allResPhotoArray.map((photo: RestaurantImage, index: number) => {
                    const isDefaultPhoto = photo.url === DEFAULT_RESTAURANT_IMAGE;
                    const isBusy = busyPhotoId === photo.id;
                    const showSetCover = isOwner && !photo.preview && !isDefaultPhoto;
                    const showRemove = canDelete(photo) && !isDefaultPhoto;
                    const isConfirming = showRemove && confirmingId === photo.id;
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
                                        <i className="fa-solid fa-star" aria-hidden="true"></i>
                                        Cover photo
                                    </span>
                                )}
                                {/* Over the photo it is about, so which one is
                                    plain, and the card keeps its height. */}
                                {isConfirming && (
                                    <InlineConfirm
                                        className="photo-confirm"
                                        question="Remove this photo?"
                                        // Only when it is known: older photos
                                        // have no uploader on record.
                                        detail={photo.createdByUserId != null && photo.createdByUserId !== sessionUser?.id
                                            ? "Someone else added it. This can't be undone."
                                            : "This can't be undone."}
                                        confirmLabel="Remove"
                                        busyLabel="Removing..."
                                        busy={isBusy}
                                        onConfirm={() => handleRemove(photo, index)}
                                        onCancel={() => setConfirmingId(null)}
                                    />
                                )}
                            </div>
                            {/* On every card, empty or not, so they all end
                                level. */}
                            <div className="photo-actions">
                                {showSetCover && (
                                    <button
                                        type="button"
                                        className="set-cover-photo"
                                        disabled={isBusy || isConfirming}
                                        onClick={() => handleSetCover(photo)}
                                    >
                                        <i className="fa-regular fa-star" aria-hidden="true"></i>
                                        Set as cover
                                    </button>
                                )}
                                {showRemove && (
                                    <button
                                        type="button"
                                        className="delete-photo"
                                        disabled={isBusy}
                                        aria-expanded={isConfirming}
                                        onClick={() => askToRemove(photo)}
                                    >
                                        <i className="fa-regular fa-trash-can" aria-hidden="true"></i>
                                        Remove
                                    </button>
                                )}
                            </div>
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