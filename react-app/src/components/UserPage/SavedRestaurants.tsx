import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAppDispatch } from "../../store";
import { fetchFavorites } from "../../store/favorites";
import { Restaurant } from "../../types";
import FavoriteButton from "../FavoriteButton";
import RatingStar from "../RatingStar";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../utils/images";
import "../../styles/show-more.css";

interface SavedRestaurantsProps {
    userId: number;
}

/**
 * The Saved tab: the restaurants you have hearted, newest first.
 *
 * Only ever shown on your own profile -- the API refuses anyone else -- and
 * fetched each time the tab opens, so something saved a minute ago on
 * another page is here. Unsaving one takes it off the list at once.
 */
function SavedRestaurants({ userId }: SavedRestaurantsProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const [items, setItems] = useState<Restaurant[]>([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [errors, setErrors] = useState<string[]>([]);
    const [loadingMore, setLoadingMore] = useState(false);
    // Where focus should go after an unsave. The heart that had it has just
    // been removed with its card, and would otherwise leave focus on <body>.
    const [refocusAt, setRefocusAt] = useState<number | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const emptyHeadingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        let cancelled = false;
        setStatus("loading");
        dispatch(fetchFavorites(userId)).then((result) => {
            if (cancelled) return;
            if (result.errors) {
                setErrors(result.errors);
                setStatus("error");
                return;
            }
            setItems(result.page.items);
            setTotal(result.page.total);
            setStatus("ready");
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, userId]);

    const showMore = async () => {
        setLoadingMore(true);
        // What comes after the cards still here. Unsaving one here takes it
        // off the server's list too, so this count is where the rest start.
        const result = await dispatch(fetchFavorites(userId, items.length));
        setLoadingMore(false);
        if (result.errors) {
            setErrors(result.errors);
            return;
        }
        const next = result.page;
        // Something saved since, on another page, moves the rest down one, so
        // a card can arrive twice; keep the first copy.
        const fresh = next.items.filter((item) => !items.some((kept) => kept.id === item.id));
        setItems((current) => [...current, ...fresh]);
        // Nothing new means the end, whatever the count says: a save made
        // elsewhere is counted in the total but sits at the top, above this
        // list, so the count stays one ahead and the button would otherwise
        // stay, fetching nothing.
        setTotal(fresh.length ? next.total : items.length);
    };

    const removed = (restaurantId: number) => {
        setRefocusAt(items.findIndex((item) => item.id === restaurantId));
        setItems((current) => current.filter((item) => item.id !== restaurantId));
        setTotal((count) => Math.max(count - 1, 0));
    };

    useEffect(() => {
        if (refocusAt === null) return;
        // The heart that took its place, or the one before it if that was
        // the last card, or the empty list's heading if it was the only one.
        const hearts = gridRef.current
            ? Array.from(gridRef.current.querySelectorAll<HTMLElement>(".favorite-button"))
            : [];
        const next = hearts[Math.min(refocusAt, hearts.length - 1)];
        if (next) next.focus();
        else if (emptyHeadingRef.current) emptyHeadingRef.current.focus();
        setRefocusAt(null);
    }, [items, refocusAt]);

    if (status === "loading") {
        return <p className="profile-saved-status" role="status">Loading your saved restaurants…</p>;
    }

    if (status === "error") {
        return (
            <div className="profile-empty" role="alert">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                <h2>{errors[0]}</h2>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="profile-empty">
                <i className="fa-regular fa-heart" aria-hidden="true"></i>
                <h2 ref={emptyHeadingRef} tabIndex={-1}>You haven't saved any restaurants yet</h2>
                <p>Tap the heart on a restaurant to keep it here. Only you can see this list.</p>
                <Link to="/restaurants" className="profile-link-button">Browse restaurants</Link>
            </div>
        );
    }

    return (
        <>
            <p className="profile-saved-note">Only you can see the restaurants you've saved.</p>
            <div className="profile-business-grid" ref={gridRef}>
                {items.map((restaurant) => (
                    <div className="profile-saved-card" key={restaurant.id}>
                        <Link to={`/single/${restaurant.id}`} className="profile-business-card">
                            <img
                                src={restaurant.previewImage || DEFAULT_RESTAURANT_IMAGE}
                                alt=""
                                onError={onRestaurantImageError}
                            />
                            <div className="profile-business-body">
                                <div className="profile-business-name">{restaurant.name}</div>
                                <div className="profile-business-rating">
                                    <RatingStar size="16" rating={restaurant.avgRating} />
                                    <span>{restaurant.numReviews || 0} review{restaurant.numReviews === 1 ? "" : "s"}</span>
                                </div>
                                <div className="profile-business-meta">
                                    {restaurant.price} · {restaurant.city}, {restaurant.state}
                                </div>
                            </div>
                        </Link>
                        <FavoriteButton
                            className="profile-saved-favorite"
                            restaurantId={restaurant.id}
                            name={restaurant.name}
                            isFavorited={restaurant.isFavorited !== false}
                            onChange={(isFavorited) => { if (!isFavorited) removed(restaurant.id); }}
                        />
                    </div>
                ))}
            </div>
            {items.length < total && (
                <div className="show-more">
                    <button
                        type="button"
                        className="show-more-button"
                        onClick={showMore}
                        disabled={loadingMore}
                    >
                        {loadingMore ? "Loading…" : `Show more (${items.length} of ${total})`}
                    </button>
                </div>
            )}
        </>
    );
}

export default SavedRestaurants;
