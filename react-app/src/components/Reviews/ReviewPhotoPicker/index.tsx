import React, { useEffect, useRef, useState } from "react";

import "./ReviewPhotoPicker.css";
import { MAX_REVIEW_PHOTOS } from "../../../store/reviews";
import { ReviewImage } from "../../../types";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../../utils/uploads";
import { onRestaurantImageError } from "../../../utils/images";

/** A file chosen for upload, not yet sent anywhere. */
export interface PendingPhoto {
    key: string;
    file: File;
    /** A blob: url for the thumbnail; revoked when the photo is dropped. */
    preview: string;
}

interface ReviewPhotoPickerProps {
    pending: PendingPhoto[];
    onPendingChange: (next: PendingPhoto[]) => void;
    /** Photos the review already has, on the edit page. */
    existing?: ReviewImage[];
    onRemoveExisting?: (image: ReviewImage) => void;
    /** The existing photo being removed right now, if any. */
    removingId?: number | null;
    disabled?: boolean;
}

let nextKey = 0;

/**
 * Photos for a review: the ones it has, and new ones chosen to go with it.
 *
 * Choosing a file only stages it. Nothing is uploaded until the form is
 * submitted, so a reader who changes their mind, or never posts, leaves
 * nothing behind in the bucket.
 */
function ReviewPhotoPicker({
    pending, onPendingChange, existing = [], onRemoveExisting, removingId = null, disabled = false,
}: ReviewPhotoPickerProps): React.JSX.Element {
    const [notice, setNotice] = useState<string | null>(null);

    // The blob: urls live as long as this picker. The latest list is read
    // through a ref because the unmount cleanup below only runs once.
    const pendingRef = useRef(pending);
    pendingRef.current = pending;
    useEffect(() => () => {
        pendingRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    }, []);

    const room = MAX_REVIEW_PHOTOS - existing.length - pending.length;

    const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(event.target.files || []);
        // Clear the input so choosing the same file again still fires.
        event.target.value = "";
        if (chosen.length === 0) return;

        const tooLarge = chosen.filter((file) => file.size > MAX_UPLOAD_MB * 1024 * 1024);
        const fitting = chosen.filter((file) => file.size <= MAX_UPLOAD_MB * 1024 * 1024);
        const taken = fitting.slice(0, Math.max(room, 0));

        const notes: string[] = [];
        if (tooLarge.length) {
            notes.push(`${tooLarge.map((file) => file.name).join(", ")} ${tooLarge.length === 1 ? "is" : "are"} over ${MAX_UPLOAD_MB} MB.`);
        }
        if (fitting.length > taken.length) {
            notes.push(`A review can have ${MAX_REVIEW_PHOTOS} photos, so ${fitting.length - taken.length} ${fitting.length - taken.length === 1 ? "was" : "were"} left out.`);
        }
        setNotice(notes.length ? notes.join(" ") : null);

        if (taken.length === 0) return;
        onPendingChange([
            ...pending,
            ...taken.map((file) => ({
                key: `pending-${nextKey++}`,
                file,
                preview: URL.createObjectURL(file),
            })),
        ]);
    };

    const drop = (photo: PendingPhoto) => {
        URL.revokeObjectURL(photo.preview);
        setNotice(null);
        onPendingChange(pending.filter((kept) => kept.key !== photo.key));
    };

    const total = existing.length + pending.length;

    return (
        <div className="review-photo-picker">
            <div className="review-photo-picker-heading">
                <span className="review-photo-picker-title">Photos</span>
                <span className="review-photo-picker-count">{total} of {MAX_REVIEW_PHOTOS}</span>
            </div>

            {total > 0 && (
                <div className="review-photo-picker-grid">
                    {existing.map((image, index) => (
                        <div className="review-photo-picker-item" key={`existing-${image.id}`}>
                            <img src={image.url} alt={`Already on this review, ${index + 1} of ${existing.length}`} onError={onRestaurantImageError} />
                            {onRemoveExisting && (
                                <button
                                    type="button"
                                    className="review-photo-picker-remove"
                                    onClick={() => onRemoveExisting(image)}
                                    disabled={disabled || removingId !== null}
                                    aria-label={`Remove photo ${index + 1}`}
                                >
                                    {removingId === image.id ? "…" : "×"}
                                </button>
                            )}
                        </div>
                    ))}
                    {pending.map((photo) => (
                        <div className="review-photo-picker-item pending" key={photo.key}>
                            <img src={photo.preview} alt={`${photo.file.name}, not yet uploaded`} />
                            <button
                                type="button"
                                className="review-photo-picker-remove"
                                onClick={() => drop(photo)}
                                disabled={disabled}
                                aria-label={`Don't add ${photo.file.name}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {room > 0 && (
                <label className="review-photo-picker-choose">
                    <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        multiple
                        onChange={choose}
                        disabled={disabled}
                    />
                    <span className="review-photo-picker-button">
                        <i className="fa-regular fa-image"></i> Add photos
                    </span>
                    <span className="review-photo-picker-hint">
                        PNG, JPG, GIF or WEBP, up to {MAX_UPLOAD_MB} MB each
                    </span>
                </label>
            )}

            {notice && <p className="review-photo-picker-notice" role="status">{notice}</p>}
        </div>
    );
}

export default ReviewPhotoPicker;
