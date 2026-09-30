import React from "react";
import { Link } from "react-router-dom";
import "./Restaurant.css"
import RatingStar from "../RatingStar"
import CategoryChips from "../CategoryChips"
import OpenStatus from "../OpenStatus"
import { RestaurantProps } from "../../types";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../utils/images";

/**
 * A restaurant's card in a list.
 *
 * The name is the link, stretched over the whole card, so the card still
 * opens the restaurant wherever it is clicked (#122). The whole card used to
 * be the link: its name was everything on the card read out at once, name,
 * price, cuisines and a review, and the cuisine chips were buttons inside it,
 * which HTML does not allow. Now the chips are links of their own, laid over
 * the stretched one, and the name is a heading, so the list can be walked by
 * its headings.
 */
function Restaurant({ restaurant }: RestaurantProps): React.JSX.Element {
    const tick = (
        <svg width="16" height="16" className="tick">
            <path d="M6.308 11.763a.748.748 0 01-.53-.22l-2.641-2.64a.75.75 0 011.06-1.061l2.11 2.11 5.496-5.495a.75.75 0 111.06 1.06l-6.025 6.026a.748.748 0 01-.53.22z" />
        </svg>
    );

    const reviewBubble = (
        <svg width="16" height="16" className="cloud">
            <path d="M5 14.309a.749.749 0 01-.75-.75v-2.45a3.768 3.768 0 01-3-3.667V5.44A3.754 3.754 0 015 1.69h6a3.754 3.754 0 013.75 3.75v2A3.755 3.755 0 0111 11.19H8.924l-3.437 2.938a.75.75 0 01-.487.18zM5 3.191a2.253 2.253 0 00-2.25 2.25v2a2.259 2.259 0 002.215 2.25.792.792 0 01.785.75v1.49l2.41-2.06a.749.749 0 01.487-.18H11a2.253 2.253 0 002.25-2.25v-2A2.253 2.253 0 0011 3.19H5z" />
        </svg>
    );

    return (
        <div className="restaurant-card">
            {/* alt="": the name is right beside it, and is the link. */}
            <img className="square" src={restaurant.previewImage || DEFAULT_RESTAURANT_IMAGE} alt="" onError={onRestaurantImageError}/>
            <div className="summary">
                {/* No id prefix: it was standing in for a list number and
                    read 1, 2, 5, 9 as soon as anything was deleted. */}
                <h2 className="bold-name">
                    <Link className="restaurant-card-link" to={`/single/${restaurant.id}`}>
                        {restaurant.name}
                    </Link>
                </h2>
                <div className="stars-home">
                    <RatingStar size="20" rating={restaurant.avgRating} />
                    {/* The number beside the stars it stands for: a half star
                        and an empty one are hard to tell apart at this size
                        (#121). Hidden from screen readers, which hear it in
                        the stars' own label. */}
                    {restaurant.numReviews ? (
                        <span className="stars-home-number" aria-hidden="true">
                            {restaurant.avgRating.toFixed(1)}
                        </span>
                    ) : (
                        <span className="stars-home-number">No reviews yet</span>
                    )}
                </div>
                <div className="small-words">
                    <div>
                        {restaurant.price} <b>·</b> {restaurant.city}
                    </div>
                    <CategoryChips categories={restaurant.categories} />
                    <OpenStatus status={restaurant.openStatus} />
                    <div>
                        {reviewBubble} {restaurant.oneReview}
                    </div>
                    {restaurant.amenities && restaurant.amenities.length > 0 && (
                        <div className="three-tick">
                            {/* What this restaurant actually offers, three at
                                most: the card had the same three typed into
                                it for every business on the site. */}
                            {restaurant.amenities.slice(0, 3).map((amenity) => (
                                <span className="delivery" key={amenity.id}>{tick}{amenity.name}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


export default Restaurant
