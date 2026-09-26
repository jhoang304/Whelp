import React, { useEffect, useRef } from "react";

import "./Lightbox.css";
import { useDialog } from "../../hooks/useDialog";

export interface LightboxPhoto {
    url: string;
    /** What the enlarged photo shows, for a reader who cannot see it. */
    alt: string;
}

interface LightboxProps {
    photos: LightboxPhoto[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}

/**
 * One photo, full screen, with the others a step away.
 *
 * Lifted out of the restaurant photo modal when review photos needed the same
 * viewer: a second copy would have been the fourth control this month to be
 * written twice and then drift. Escape closes it and the arrow keys move
 * through the photos, which the old one did not do; focus moves in when it
 * opens and back to the thumbnail when it closes.
 *
 * A click anywhere but the photo closes it. The close button is there for
 * the keyboard and screen readers, and only shows when the keyboard reaches
 * it (Lightbox.css).
 */
function Lightbox({ photos, index, onIndexChange, onClose }: LightboxProps): React.JSX.Element | null {
    const count = photos.length;
    const dialogRef = useRef<HTMLDivElement>(null);

    // Escape is handled here, so that when this opens inside the photos
    // modal, Escape closes the photo and not the modal behind it.
    useDialog(dialogRef, true, onClose);

    const step = (by: number) => onIndexChange((index + by + count) % count);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft" && count > 1) onIndexChange((index - 1 + count) % count);
            else if (event.key === "ArrowRight" && count > 1) onIndexChange((index + 1) % count);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [index, count, onIndexChange]);

    const photo = photos[index];
    if (!photo) return null;

    return (
        <div
            ref={dialogRef}
            className="image-viewer-overlay"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-label="Photo viewer"
            onClick={onClose}
        >
            <div className="image-viewer-container">
                <button
                    type="button"
                    className="image-viewer-close"
                    onClick={(event) => {
                        // Or the click reaches the backdrop too, and whoever
                        // passed onClose hears about it twice.
                        event.stopPropagation();
                        onClose();
                    }}
                    aria-label="Close image viewer"
                >
                    <i className="fa-solid fa-times"></i>
                </button>

                {count > 1 && (
                    <button
                        type="button"
                        className="image-nav-arrow image-nav-prev"
                        onClick={(event) => {
                            event.stopPropagation();
                            step(-1);
                        }}
                        aria-label="Previous photo"
                    >
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                )}

                <img
                    className="image-viewer-photo"
                    src={photo.url}
                    alt={photo.alt}
                    onClick={(event) => event.stopPropagation()}
                />

                {count > 1 && (
                    <button
                        type="button"
                        className="image-nav-arrow image-nav-next"
                        onClick={(event) => {
                            event.stopPropagation();
                            step(1);
                        }}
                        aria-label="Next photo"
                    >
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                )}

                <div className="image-counter">
                    {index + 1} / {count}
                </div>
            </div>
        </div>
    );
}

export default Lightbox;
