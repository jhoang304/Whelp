import React, { useState } from "react";

import "./FavoriteButton.css";
import { useAppDispatch } from "../../store";
import { setFavorite } from "../../store/favorites";

interface FavoriteButtonProps {
    restaurantId: number;
    /** The restaurant's name, for the button's accessible name. */
    name: string;
    isFavorited: boolean;
    /** "icon" is the round heart over a card; "labelled" says Save beside it. */
    variant?: "icon" | "labelled";
    /** On the wrapper, which holds the button and its error message. */
    className?: string;
    /** After the API has answered, with where things now stand. */
    onChange?: (isFavorited: boolean) => void;
}

/**
 * The heart that saves a restaurant.
 *
 * A toggle button: its name stays "Save <restaurant>" and aria-pressed says
 * whether it is saved, which is how a screen reader expects a toggle to
 * behave -- "Save Nancy's Hustle, toggle button, pressed". Changing the name
 * to "Unsave" as well would say the same thing twice, the second time
 * backwards.
 *
 * It waits for the API rather than flipping first and apologising later: a
 * heart that fills and then empties again looks broken, and the request is
 * quick. If it fails, the heart stays as it was and the reason is announced.
 */
function FavoriteButton({
    restaurantId, name, isFavorited, variant = "icon", className = "", onChange,
}: FavoriteButtonProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const errors = await dispatch(setFavorite(restaurantId, !isFavorited, isFavorited));
        setBusy(false);
        if (errors) setError(errors[0]);
        else if (onChange) onChange(!isFavorited);
    };

    return (
        <span className={`favorite ${className}`}>
            <button
                type="button"
                className={`favorite-button favorite-button-${variant}${isFavorited ? " saved" : ""}`}
                aria-pressed={isFavorited}
                aria-label={`Save ${name}`}
                title={isFavorited ? "Saved" : "Save"}
                onClick={toggle}
                // Not `disabled`: that would drop keyboard focus off the
                // button mid-request. The click handler ignores it instead.
                aria-disabled={busy || undefined}
            >
                <i className={`${isFavorited ? "fa-solid" : "fa-regular"} fa-heart`} aria-hidden="true"></i>
                {/* Always "Save", never "Saved": the visible word has to be
                    part of the button's name, or someone who operates it by
                    voice says what they see and nothing happens. The filled
                    heart and aria-pressed carry the state. */}
                {variant === "labelled" && <span>Save</span>}
            </button>
            <span className="favorite-error" role="status">{error}</span>
        </span>
    );
}

export default FavoriteButton;
