import { Review, UserProfile, UserProfileState } from '../types';
import { AnyAction } from 'redux';

import { AppDispatch } from './index';
import { parseErrors } from '../utils/parseErrors';
import { setUser } from './session';
import { FAVORITE_CHANGED } from './favorites';
import { apiFetch } from '../utils/api';

const LOAD_PROFILE = 'userProfile/LOAD_PROFILE';
const CLEAR_PROFILE = 'userProfile/CLEAR_PROFILE';

const loadProfile = (profile: UserProfile, reviews: Review[]) => ({
    type: LOAD_PROFILE,
    profile,
    reviews,
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
 * with every review they have written. Returns null on success or a list of
 * error messages on failure, and null without touching the store when
 * another profile has been asked for since.
 */
export const getProfileThunk = (userId: string | number) => async (dispatch: AppDispatch) => {
    const requested = String(userId);
    latestProfileId = requested;
    const superseded = () => latestProfileId !== requested;

    const [profileRes, reviewsRes] = await Promise.all([
        apiFetch(`/api/users/get/${userId}`),
        apiFetch(`/api/users/${userId}/reviews`),
    ]);

    if (profileRes.ok && reviewsRes.ok) {
        const profile: UserProfile = await profileRes.json();
        const reviews: Review[] = await reviewsRes.json();
        if (superseded()) return null;
        dispatch(loadProfile(profile, reviews));
        return null;
    }

    if (superseded()) return null;
    dispatch(clearProfile());
    if (profileRes.status === 404) {
        return ["We couldn't find that user."];
    }
    return ["Something went wrong loading this profile."];
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
    const response = await apiFetch(`/api/users/${userId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (response.ok) {
        const data = await response.json().catch(() => ({}));
        dispatch(setUser(data));
        await dispatch(getProfileThunk(userId));
        return null;
    }
    return parseErrors(response, "Could not update your profile. Please try again.");
};

const initialState: UserProfileState = { profile: null, reviews: [] };

export default function userProfileReducer(state: UserProfileState = initialState, action: AnyAction): UserProfileState {
    switch (action.type) {
        case LOAD_PROFILE:
            return { profile: action.profile, reviews: action.reviews };
        case CLEAR_PROFILE:
            return { profile: null, reviews: [] };
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
