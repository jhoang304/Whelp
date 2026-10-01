import React, { useEffect, useRef, useState } from "react";

import "./ReviewPhotoPicker.css";
import { MAX_REVIEW_PHOTOS } from "../../../store/reviews";
import { ReviewImage } from "../../../types";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../../utils/uploads";
import { onRestaurantImageError } from "../../../utils/images";
import InlineConfirm from "../../InlineConfirm";
import { useFocusAfterRender } from "../../../hooks/useFocusAfterRender";

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
    /** Removes it from the review, resolving to whether it went. */
    onRemoveExisting?: (image: ReviewImage) => Promise<boolean>;
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
    // The photo the review already has whose × is asking first (#131): it
    // comes off the review, and out of the bucket, the moment it's removed.
    // A staged photo's × doesn't ask; nothing is lost, the file is still
    // wherever it was chosen from.
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    // "Photo removed.", for a screen reader: the thumbnail just goes.
    const [removedNote, setRemovedNote] = useState<string>("");
    const gridRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const focusLater = useFocusAfterRender();

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
        setRemovedNote("");

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

    const askToRemove = (image: ReviewImage) => {
        setRemovedNote("");
        setConfirmingId(image.id);
    };

    // Asked and answered. A refusal leaves the question up, to try again;
    // the form says why.
    const removeExisting = async (image: ReviewImage, index: number) => {
        if (!onRemoveExisting) return;
        const removed = await onRemoveExisting(image);
        if (!removed) return;
        setConfirmingId(null);
        setRemovedNote("Photo removed.");
        // On to the photo that took its place, or the one before it if it
        // was the last; with none left, Add photos.
        focusLater(() => {
            const buttons = gridRef.current?.querySelectorAll<HTMLElement>(".review-photo-picker-remove");
            return (buttons && buttons[Math.min(index, buttons.length - 1)]) || inputRef.current;
        });
    };

    const total = existing.length + pending.length;
    const confirmingIndex = existing.findIndex((image) => image.id === confirmingId);
    const confirming = confirmingIndex >= 0 && onRemoveExisting ? existing[confirmingIndex] : null;

    return (
        <div className="review-photo-picker">
            <div className="review-photo-picker-heading">
                <span className="review-photo-picker-title">Photos</span>
                <span className="review-photo-picker-count">{total} of {MAX_REVIEW_PHOTOS}</span>
            </div>

            {total > 0 && (
                <div className="review-photo-picker-grid" ref={gridRef}>
                    {existing.map((image, index) => (
                        <div
                            className={confirming === image ? "review-photo-picker-item confirming" : "review-photo-picker-item"}
                            key={`existing-${image.id}`}
                        >
                            <img src={image.url} alt={`Already on this review, ${index + 1} of ${existing.length}`} onError={onRestaurantImageError} />
                            {onRemoveExisting && (
                                <button
                                    type="button"
                                    className="review-photo-picker-remove"
                                    onClick={() => askToRemove(image)}
                                    disabled={disabled || removingId !== null}
                                    aria-label={`Remove photo ${index + 1}`}
                                    aria-expanded={confirming === image}
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

            {/* Under the thumbnails, which are too small to hold it; the one
                it is about is outlined. */}
            {confirming && (
                <InlineConfirm
                    key={confirming.id}
                    className="review-photo-picker-confirm"
                    question={`Remove photo ${confirmingIndex + 1}?`}
                    detail="It comes off your review right away, not when you submit."
                    confirmLabel="Remove"
                    busyLabel="Removing..."
                    busy={removingId === confirming.id}
                    onConfirm={() => removeExisting(confirming, confirmingIndex)}
                    onCancel={() => setConfirmingId(null)}
                />
            )}

            {room > 0 && (
                <label className="review-photo-picker-choose">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        multiple
                        onChange={choose}
                        disabled={disabled}
                    />
                    <span className="review-photo-picker-button">
                        <i className="fa-regular fa-image" aria-hidden="true"></i> Add photos
                    </span>
                    <span className="review-photo-picker-hint">
                        PNG, JPG, GIF or WEBP, up to {MAX_UPLOAD_MB} MB each
                    </span>
                </label>
            )}

            {/* One live region, on the page from the start: one put there
                with its message already in it is often not read out. Out of
                sight, and out of the column's gaps, until there's a notice. */}
            <p className={notice ? "review-photo-picker-notice" : "visually-hidden"} role="status">
                {notice}
                {removedNote && <span className="visually-hidden">{removedNote}</span>}
            </p>
        </div>
    );
}

export default ReviewPhotoPicker;
