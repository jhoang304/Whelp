import React from "react";
import { Link } from "react-router-dom";

import "./RestaurantListEntry.css";
import Restaurant from "../Restaurant";
import FavoriteButton from "../FavoriteButton";
import { useAppSelector } from "../../store";
import { Restaurant as RestaurantType } from "../../types";

interface RestaurantListEntryProps {
    restaurant: RestaurantType;
    /** The list's own class, which carries its fade-in animation. */
    className: string;
    /** Seconds to wait before fading in, to stagger the first row. */
    delay: number;
}

/**
 * One card in a list of restaurants, with its heart.
 *
 * The card is a link to the restaurant, and the heart is a button, so they
 * are siblings rather than one inside the other: a button inside a link is
 * two things to press in one place, and HTML does not allow it. The heart
 * sits over the card's corner, and only for someone logged in, who has a
 * list to save to.
 */
function RestaurantListEntry({ restaurant, className, delay }: RestaurantListEntryProps): React.JSX.Element {
    const sessionUser = useAppSelector((state) => state.session.user);

    return (
        <div className={`restaurant-list-entry ${className}`} style={{ animationDelay: `${delay}s` }}>
            <Link className="restaurant-list-link" to={`/single/${restaurant.id}`}>
                <Restaurant restaurant={restaurant} />
            </Link>
            {sessionUser && (
                <FavoriteButton
                    className="restaurant-list-favorite"
                    restaurantId={restaurant.id}
                    name={restaurant.name}
                    isFavorited={!!restaurant.isFavorited}
                />
            )}
        </div>
    );
}

export default RestaurantListEntry;
