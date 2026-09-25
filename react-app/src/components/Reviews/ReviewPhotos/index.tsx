import React, { useState } from "react";

import "./ReviewPhotos.css";
import Lightbox from "../../Lightbox";
import { ReviewImage } from "../../../types";
import { onRestaurantImageError } from "../../../utils/images";

interface ReviewPhotosProps {
    photos?: ReviewImage[];
    /** Whose review it is, so a screen reader hears more than "image". */
    author?: string;
}

/**
 * The photos under a review, opening full screen when one is clicked.
 *
 * Every review payload has carried `reviewImages` for a long time and nothing
 * drew them. Now something does, which is why adding one was made the
 * author's alone first: until then anyone could attach any url to anyone's
 * review, and this is where it would have appeared.
 */
function ReviewPhotos({ photos, author }: ReviewPhotosProps): React.JSX.Element | null {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    if (!photos || photos.length === 0) return null;

    const whose = author ? `${author}'s review` : "this review";
    // Not "Photo 1 of 3": a screen reader already says it is an image.
    const described = photos.map((photo, index) => ({
        url: photo.url,
        alt: `From ${whose}, ${index + 1} of ${photos.length}`,
    }));

    return (
        <div className="review-photos">
            {described.map((photo, index) => (
                <button
                    key={photos[index].id}
                    type="button"
                    className="review-photos-thumb"
                    onClick={() => setOpenIndex(index)}
                    aria-label={`Enlarge photo ${index + 1} of ${photos.length} from ${whose}`}
                >
                    <img src={photo.url} alt="" onError={onRestaurantImageError} />
                </button>
            ))}

            {openIndex !== null && (
                <Lightbox
                    photos={described}
                    index={openIndex}
                    onIndexChange={setOpenIndex}
                    onClose={() => setOpenIndex(null)}
                />
            )}
        </div>
    );
}

export default ReviewPhotos;
