import { Review, UserProfile, UserProfileState } from '../types';
import { setUser } from './session';

const LOAD_PROFILE = 'userProfile/LOAD_PROFILE';
const CLEAR_PROFILE = 'userProfile/CLEAR_PROFILE';

const loadProfile = (profile: UserProfile, reviews: Review[]) => ({
    type: LOAD_PROFILE,
    profile,
    reviews,
});

export const clearProfile = () => ({ type: CLEAR_PROFILE });

/**
 * Load a user's public profile (name, avatar, businesses, counts) together
 * with every review they have written. Returns null on success or a list of
 * error messages on failure.
 */
export const getProfileThunk = (userId: string | number) => async (dispatch: any) => {
    const [profileRes, reviewsRes] = await Promise.all([
        fetch(`/api/users/get/${userId}`),
        fetch(`/api/reviews/${userId}`),
    ]);

    if (profileRes.ok && reviewsRes.ok) {
        const profile: UserProfile = await profileRes.json();
        const reviews: Review[] = await reviewsRes.json();
        dispatch(loadProfile(profile, reviews));
        return null;
    }

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
export const editProfileThunk = (updates: ProfileUpdates, userId: string | number) => async (dispatch: any) => {
    const response = await fetch(`/api/users/${userId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
        dispatch(setUser(data));
        await dispatch(getProfileThunk(userId));
        return null;
    }
    if (Array.isArray(data.errors)) return data.errors;
    return ["Could not update your profile. Please try again."];
};

const initialState: UserProfileState = { profile: null, reviews: [] };

export default function userProfileReducer(state: UserProfileState = initialState, action: any): UserProfileState {
    switch (action.type) {
        case LOAD_PROFILE:
            return { profile: action.profile, reviews: action.reviews };
        case CLEAR_PROFILE:
            return { profile: null, reviews: [] };
        default:
            return state;
    }
}
