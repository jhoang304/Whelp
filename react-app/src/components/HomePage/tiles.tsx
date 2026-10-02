import React from "react";
import { Link } from "react-router-dom";
import RatingStar from "../RatingStar";
import { Restaurant, Review } from "../../types";
import {
    DEFAULT_RESTAURANT_IMAGE, avatarUrl, onAvatarError, onRestaurantImageError,
} from "../../utils/images";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

/**
 * A restaurant, small: its photo, name, stars, price and city, and cuisines.
 * The whole tile follows the name's link -- one link, so Tab stops once per
 * restaurant and a screen reader hears its name, not the tile's every word.
 */
export function RestaurantTile({ restaurant }: { restaurant: Restaurant }): React.JSX.Element {
    const reviewed = (restaurant.numReviews ?? 0) > 0;
    const cuisines = (restaurant.categories ?? []).map((category) => category.name).join(", ");
    return (
        <li className="home-tile">
            <img
                className="home-tile-photo"
                src={restaurant.previewImage || DEFAULT_RESTAURANT_IMAGE}
                alt=""
                onError={onRestaurantImageError}
            />
            <div className="home-tile-body">
                <h3 className="home-tile-name">
                    <Link className="home-tile-link" to={`/single/${restaurant.id}`}>{restaurant.name}</Link>
                </h3>
                <div className="home-tile-rating">
                    {reviewed ? (
                        <>
                            <RatingStar size="16" rating={restaurant.avgRating} />
                            <span>
                                {restaurant.numReviews} {restaurant.numReviews === 1 ? "review" : "reviews"}
                            </span>
                        </>
                    ) : (
                        <span>No reviews yet</span>
                    )}
                </div>
                <p className="home-tile-meta">{restaurant.price} · {restaurant.city}</p>
                {cuisines && <p className="home-tile-cuisines">{cuisines}</p>}
            </div>
        </li>
    );
}

/** A grey restaurant tile, while the real ones load. */
export function RestaurantTileSkeleton(): React.JSX.Element {
    return (
        <li className="home-tile home-skeleton">
            <div className="home-tile-photo" />
            <div className="home-tile-body">
                <div className="home-skeleton-line wide" />
                <div className="home-skeleton-line" />
                <div className="home-skeleton-line short" />
            </div>
        </li>
    );
}

/**
 * A review, as on a profile but shorter: who wrote it and when, the stars,
 * the restaurant, and the first few lines of what they said.
 */
export function ReviewTile({ review }: { review: Review }): React.JSX.Element {
    const restaurantName = review.restaurant ? review.restaurant.name : "a restaurant";
    return (
        <li className="home-review">
            <div className="home-review-author">
                <img className="home-review-avatar" src={avatarUrl(review.user)} alt="" onError={onAvatarError} />
                <div>
                    {review.user ? (
                        <Link className="home-review-name" to={`/users/get/${review.user.id}`}>{review.user.username}</Link>
                    ) : (
                        <span className="home-review-name">Deleted user</span>
                    )}
                    <div className="home-review-date">
                        {new Date(review.createdAt).toLocaleDateString("en-US", DATE_OPTIONS)}
                    </div>
                </div>
            </div>
            <div className="home-review-rating">
                <RatingStar size="16" rating={review.rating} />
                <span className="home-review-place">
                    at <Link to={`/single/${review.restaurant_id}`}>{restaurantName}</Link>
                </span>
            </div>
            <p className="home-review-text">{review.review}</p>
        </li>
    );
}

/** A grey review, while the real ones load. */
export function ReviewTileSkeleton(): React.JSX.Element {
    return (
        <li className="home-review home-skeleton">
            <div className="home-review-author">
                <div className="home-review-avatar" />
                <div className="home-skeleton-line short" />
            </div>
            <div className="home-skeleton-line" />
            <div className="home-skeleton-line wide" />
            <div className="home-skeleton-line wide" />
        </li>
    );
}
