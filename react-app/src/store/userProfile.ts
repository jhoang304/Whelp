import { Review, UserProfile, UserProfileState } from '../types';
import { AnyAction } from 'redux';

import { AppDispatch } from './index';
import { parseErrors } from '../utils/parseErrors';
import { setUser } from './session';
import { FAVORITE_CHANGED } from './favorites';
import { apiFetch, NETWORK_ERROR } from '../utils/api';

const LOAD_PROFILE = 'userProfile/LOAD_PROFILE';
const CLEAR_PROFILE = 'userProfile/CLEAR_PROFILE';
const LOAD_MORE_REVIEWS = 'userProfile/LOAD_MORE_REVIEWS';

/**
 * A profile's reviews come a page at a time, like a restaurant's (#137): a
 * prolific reviewer's profile loaded every review, photo and reply at once.
 */
export const PROFILE_REVIEWS_PER_PAGE = 10;

/** A page of a user's reviews, as GET /api/users/<id>/reviews answers. */
interface ReviewPage {
    items: Review[];
    total: number;
}

const loadProfile = (profile: UserProfile, reviews: Review[], reviewsTotal: number) => ({
    type: LOAD_PROFILE,
    profile,
    reviews,
    reviewsTotal,
});

const loadMoreReviews = (reviews: Review[], reviewsTotal: number) => ({
    type: LOAD_MORE_REVIEWS,
    reviews,
    reviewsTotal,
});

export const clearProfile = () => ({ type: CLEAR_PROFILE });

// The profile most recently asked for. There is one profile in the store, so
// going from one profile to another before the first has loaded leaves both
// requests in flight, and the first answering last used to leave user 1's
// profile under /users/get/2 -- or, if it failed, "We couldn't find that
// user" (#115). Only the latest request may write.
let latestProfileId: string | null = null;

/**
 * Load a user's public profile (name, avatar, businesses, counts) together
 * with the first page of their reviews. Returns null on success or a list of
 * error messages on failure, and null without touching the store when
 * another profile has been asked for since.
 */
export const getProfileThunk = (userId: string | number) => async (dispatch: AppDispatch) => {
    const requested = String(userId);
    latestProfileId = requested;
    const superseded = () => latestProfileId !== requested;

    let profileRes: Response;
    let reviewsRes: Response;
    try {
        [profileRes, reviewsRes] = await Promise.all([
            apiFetch(`/api/users/get/${userId}`),
            apiFetch(`/api/users/${userId}/reviews?per_page=${PROFILE_REVIEWS_PER_PAGE}`),
        ]);
    } catch (networkError) {
        // "Loading profile..." stayed up for good on a dropped connection (#116).
        return superseded() ? null : [NETWORK_ERROR];
    }

    if (profileRes.ok && reviewsRes.ok) {
        const profile: UserProfile = await profileRes.json();
        const page: ReviewPage = await reviewsRes.json();
        if (superseded()) return null;
        dispatch(loadProfile(profile, page.items, page.total));
        return null;
    }

    if (superseded()) return null;
    dispatch(clearProfile());
    if (profileRes.status === 404) {
        return ["We couldn't find that user."];
    }
    return ["Something went wrong loading this profile."];
};

/**
 * The next page of the profile's reviews, after the `offset` already shown.
 * An offset rather than a page number, so a review deleted meanwhile can't
 * make the next page skip one. Returns null on success, or the messages.
 */
export const loadMoreProfileReviews = (userId: string | number, offset: number) => async (dispatch: AppDispatch) => {
    const requested = String(userId);
    let response: Response;
    try {
        response = await apiFetch(`/api/users/${userId}/reviews?offset=${offset}&per_page=${PROFILE_REVIEWS_PER_PAGE}`);
    } catch (networkError) {
        return [NETWORK_ERROR];
    }
    if (!response.ok) {
        return parseErrors(response, "Couldn't load more reviews. Please try again.");
    }
    const page: ReviewPage = await response.json();
    // Another profile since: these aren't its reviews.
    if (latestProfileId !== requested) return null;
    dispatch(loadMoreReviews(page.items, page.total));
    return null;
};

export interface ProfileUpdates {
    username: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string; // "" removes the current picture
}

/**
 * Update the logged-in user's own profile. On success the session user is
 * refreshed (so the nav bar updates) and the profile is reloaded.
 * Returns null on success or a list of error messages.
 */
export const editProfileThunk = (updates: ProfileUpdates, userId: string | number) => async (dispatch: AppDispatch) => {
    let response: Response;
    try {
        response = await apiFetch(`/api/users/${userId}/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
    } catch (networkError) {
        return [NETWORK_ERROR];
    }
    if (response.ok) {
        const data = await response.json().catch(() => ({}));
        dispatch(setUser(data));
        await dispatch(getProfileThunk(userId));
        return null;
    }
    return parseErrors(response, "Could not update your profile. Please try again.");
};

const initialState: UserProfileState = { profile: null, reviews: [], reviewsTotal: 0 };

export default function userProfileReducer(state: UserProfileState = initialState, action: AnyAction): UserProfileState {
    switch (action.type) {
        case LOAD_PROFILE:
            return { profile: action.profile, reviews: action.reviews, reviewsTotal: action.reviewsTotal };
        case CLEAR_PROFILE:
            return initialState;
        case LOAD_MORE_REVIEWS: {
            // A review written since moves the rest down one, so one can
            // arrive twice: keep the first copy. Nothing new means the end,
            // whatever the count says, or Show more would stay and fetch nothing.
            const fresh = (action.reviews as Review[]).filter((review) => !state.reviews.some((kept) => kept.id === review.id));
            const reviews = [...state.reviews, ...fresh];
            return { ...state, reviews, reviewsTotal: fresh.length ? action.reviewsTotal : reviews.length };
        }
        case FAVORITE_CHANGED: {
            const { profile } = state;
            if (!profile) return state;
            // The count is only there on your own profile, and only moves
            // when the flag really changed: saving something already saved
            // is not a second save.
            const delta = action.isFavorited === action.wasFavorited ? 0 : action.isFavorited ? 1 : -1;
            return {
                ...state,
                profile: {
                    ...profile,
                    restaurants: profile.restaurants.map((restaurant) =>
                        restaurant.id === action.restaurantId
                            ? { ...restaurant, isFavorited: action.isFavorited }
                            : restaurant),
                    favorite_count: profile.favorite_count === undefined
                        ? undefined
                        : Math.max(profile.favorite_count + delta, 0),
                },
            };
        }
        default:
            return state;
    }
}
