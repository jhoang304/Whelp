import { FavoriteChangedAction, Page, Restaurant } from "../types";
import { AppDispatch } from "./index";
import { parseErrors } from "../utils/parseErrors";

export const FAVORITE_CHANGED = "favorites/changed" as const;

export const favoriteChanged = (
    restaurantId: number, isFavorited: boolean, wasFavorited: boolean,
): FavoriteChangedAction => ({
    type: FAVORITE_CHANGED,
    restaurantId,
    isFavorited,
    wasFavorited,
});

/**
 * Save a restaurant (`save` true) or take it off the list. Returns null once
 * the API has answered, or the messages to show if it did not.
 *
 * The flag in the store comes from the API's answer rather than from what
 * was asked for: the two routes are idempotent, and their reply is where
 * things actually stand.
 */
export const setFavorite = (restaurantId: number, save: boolean, wasFavorited: boolean) =>
    async (dispatch: AppDispatch): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await fetch(`/api/restaurants/${restaurantId}/favorite`, {
                method: save ? "POST" : "DELETE",
            });
        } catch {
            return ["Couldn't reach the server. Please try again."];
        }
        if (!response.ok) {
            return parseErrors(response, save
                ? "Couldn't save this restaurant. Please try again."
                : "Couldn't remove this restaurant. Please try again.");
        }
        const body: { isFavorited: boolean } = await response.json();
        dispatch(favoriteChanged(restaurantId, body.isFavorited, wasFavorited));
        return null;
    };

export const SAVED_PER_PAGE = 20;

export type FavoritesResult =
    | { page: Page<Restaurant>; errors?: undefined }
    | { page?: undefined; errors: string[] };

/**
 * A page of the reader's own saved restaurants, newest first. Kept out of the
 * store: only the Saved tab shows it, and it is fetched fresh each time the
 * tab opens.
 */
export const fetchFavorites = (userId: number, page = 1) =>
    async (): Promise<FavoritesResult> => {
        let response: Response;
        try {
            response = await fetch(`/api/users/${userId}/favorites?page=${page}&per_page=${SAVED_PER_PAGE}`);
        } catch {
            return { errors: ["Couldn't reach the server. Please try again."] };
        }
        if (!response.ok) {
            return { errors: await parseErrors(response, "Couldn't load your saved restaurants.") };
        }
        return { page: await response.json() };
    };
