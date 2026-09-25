import { Page, Review, ReviewResponse, ReviewsState } from '../types';
import { AnyAction } from 'redux';

import { AppDispatch } from './index';
import { parseErrors } from '../utils/parseErrors';

/** What a review form sends: the API fills in the author and the restaurant. */
export interface ReviewDraft {
    review: string;
    rating: number;
    url?: string;
}

type Id = number | string;

export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

// Load all reviews by restaurantId
const LOAD_ALL_REVIEWS_BY_RESTAURANTID = 'reviews/LOAD_ALL_REVIEWS'
const  loadAllReviewsByRestaurantId = (reviews: Review[]) => {
    return {
        type:LOAD_ALL_REVIEWS_BY_RESTAURANTID,
        reviews
    }
}

export type ReviewSort = "newest" | "highest" | "lowest";

/** What a restaurant's reviews are ordered by, and what each option is called. */
export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
    { value: "newest", label: "Newest first" },
    { value: "highest", label: "Highest rated" },
    { value: "lowest", label: "Lowest rated" },
];

export const REVIEWS_PER_PAGE = 20;

export const fetchAllReviewsByRestaurantId = (
    restaurantId: Id,
    sort: ReviewSort = "newest",
    page = 1,
) => async (dispatch: AppDispatch) => {
    const res = await fetch(
        `/api/restaurants/${restaurantId}/reviews?sort=${sort}&page=${page}&per_page=${REVIEWS_PER_PAGE}`)
    if(res.ok){
        const body: Page<Review> = await res.json();
        dispatch(loadAllReviewsByRestaurantId(body.items));
        return body;
    }
    return null;
}


const LoadUserReviews = 'reviews/LoadUserReviews'

const loadUserIdRev = (reviews: Review[]) => ({
  type: LoadUserReviews,
  reviews
})

export const getAllReviewsByUserId = (user_id: Id) => async (dispatch: AppDispatch) => {
  const response = await fetch(`/api/reviews/${user_id}`)
  if(response.ok){
    const data = await response.json()
    await dispatch(loadUserIdRev(data))
    return data
  }
  return
}

// Delete a review
const DELETE_REVIEW = 'reviews/DELETE_REVIEW'
const deleteReview = (reviewId: Id) => {
    return {
        type:DELETE_REVIEW,
        reviewId
    }
}

export const deleteReviewById = (reviewId: Id) => async (dispatch: AppDispatch) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
        method:"DELETE"
    })
    if(res.ok){
        dispatch(deleteReview(reviewId))
    }
}

// Create a review
const CREATE_REVIEW = 'reviews/CREATE_REVIEW'
const createReview = (review: Review) => {
    return {
        type:CREATE_REVIEW,
        review
    }
}
/**
 * What posting a review comes back with: the review, or why it was refused.
 *
 * Not the "null or messages" the other thunks return, because a caller that
 * attaches photos needs the new review's id, and null has nowhere to put it.
 */
export type CreateReviewResult = { review: Review; errors?: undefined } | { review?: undefined; errors: string[] };

/** Post a new review. */
export const createOneReview = (newReview: ReviewDraft, restaurantId: Id) => async (dispatch: AppDispatch): Promise<CreateReviewResult> => {
    let res: Response
    try {
        res = await fetch(`/api/restaurants/${restaurantId}/reviews`, {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body:JSON.stringify(newReview)
        })
    } catch (networkError) {
        // fetch rejects, rather than resolving with a status, when the browser
        // is offline or the connection drops. Returning the message rather
        // than letting it throw is what lets the form recover.
        return { errors: [NETWORK_ERROR] }
    }
    if(res.ok){
        const review: Review = await res.json();
        dispatch(createReview(review));
        return { review };
    }
    return { errors: await parseErrors(res, "Could not post your review. Please try again.") }
}

//update a review
const UPDATE_REVIEW = 'reviews/UPDATE_REVIEW'
const updateReview = (review: Review) => {
    return {
        type:UPDATE_REVIEW,
        review
    }
}
/** Save an edited review. Returns null on success or a list of error messages. */
export const updateOneReview = (newReview: ReviewDraft, reviewId: Id) => async (dispatch: AppDispatch) => {
    let res: Response
    try {
        res = await fetch(`/api/reviews/${reviewId}`, {
            method: "PUT",
            headers: {"Content-Type":"application/json"},
            body:JSON.stringify(newReview)
        })
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if(res.ok){
        const review = await res.json();
        dispatch(updateReview(review))
        return null
    }
    return parseErrors(res, "Could not save your review. Please try again.")
}

// ---------------------------------------------------------------------------
// Photos on a review. Only its author may add or remove them; the API checks.
// ---------------------------------------------------------------------------

/** The most photos one review may carry. The API refuses the eleventh. */
export const MAX_REVIEW_PHOTOS = 10;

/**
 * Attach an uploaded photo to a review. Returns null on success or a list of
 * error messages. The review is refetched by the forms after saving, which is
 * what puts the photo on the page, so nothing is dispatched here.
 */
export const attachReviewImage = (reviewId: Id, url: string) => async (): Promise<string[] | null> => {
    let res: Response
    try {
        res = await fetch(`/api/reviews/${reviewId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        })
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if (res.ok) return null
    return parseErrors(res, "Could not attach a photo. Please try again.")
}

const REMOVE_REVIEW_IMAGE = 'reviews/REMOVE_REVIEW_IMAGE'

const removeReviewImage = (reviewId: number, imageId: number) => ({
    type: REMOVE_REVIEW_IMAGE,
    reviewId,
    imageId,
})

/** Remove one photo from a review. Returns null on success or a list of error messages. */
export const deleteReviewImage = (reviewId: number, imageId: number) => async (dispatch: AppDispatch): Promise<string[] | null> => {
    let res: Response
    try {
        res = await fetch(`/api/review-images/${imageId}`, { method: "DELETE" })
    } catch (networkError) {
        return [NETWORK_ERROR]
    }
    if (res.ok) {
        dispatch(removeReviewImage(reviewId, imageId))
        return null
    }
    return parseErrors(res, "Could not remove the photo. Please try again.")
}

// ---------------------------------------------------------------------------
// Business-owner responses (one per review)
// ---------------------------------------------------------------------------
const SET_REVIEW_RESPONSE = 'reviews/SET_REVIEW_RESPONSE'
const REMOVE_REVIEW_RESPONSE = 'reviews/REMOVE_REVIEW_RESPONSE'

const setReviewResponse = (reviewId: number, response: ReviewResponse) => ({
    type: SET_REVIEW_RESPONSE,
    reviewId,
    response,
})

const removeReviewResponse = (reviewId: number) => ({
    type: REMOVE_REVIEW_RESPONSE,
    reviewId,
})

/** Post the owner's reply. Returns null on success or a list of error messages. */
export const createReviewResponse = (reviewId: number, response: string) => async (dispatch: AppDispatch) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
    })
    if (res.ok) {
        dispatch(setReviewResponse(reviewId, await res.json()))
        return null
    }
    return parseErrors(res, "Could not post your response. Please try again.")
}

/** Edit the owner's reply. Returns null on success or a list of error messages. */
export const updateReviewResponse = (reviewId: number, response: string) => async (dispatch: AppDispatch) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
    })
    if (res.ok) {
        dispatch(setReviewResponse(reviewId, await res.json()))
        return null
    }
    return parseErrors(res, "Could not update your response. Please try again.")
}

/** Remove the owner's reply. Returns null on success or a list of error messages. */
export const deleteReviewResponse = (reviewId: number) => async (dispatch: AppDispatch) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, { method: "DELETE" })
    if (res.ok) {
        dispatch(removeReviewResponse(reviewId))
        return null
    }
    return parseErrors(res, "Could not delete your response. Please try again.")
}

type ReviewAction =
    | { type: typeof LOAD_ALL_REVIEWS_BY_RESTAURANTID; reviews: Review[] }
    | { type: typeof LoadUserReviews; reviews: Review[] }
    | { type: typeof DELETE_REVIEW; reviewId: Id }
    | { type: typeof CREATE_REVIEW; review: Review }
    | { type: typeof UPDATE_REVIEW; review: Review }
    | { type: typeof SET_REVIEW_RESPONSE; reviewId: number; response: ReviewResponse }
    | { type: typeof REMOVE_REVIEW_RESPONSE; reviewId: number }
    | { type: typeof REMOVE_REVIEW_IMAGE; reviewId: number; imageId: number };

const initialState: ReviewsState = {}
const reviewReducer = (state: ReviewsState = initialState, incoming: AnyAction): ReviewsState => {
    // The store carries other stores' actions and redux's own; those fall
    // through to default. Naming ours here is what lets the switch narrow.
    const action = incoming as ReviewAction;
    let newState: ReviewsState
    switch (action.type) {
        case LOAD_ALL_REVIEWS_BY_RESTAURANTID:
            newState = {};
            const allReviews = action.reviews
            allReviews.forEach((review: Review) =>{
                newState[review["id"]] = review
            })
            return newState

        case LoadUserReviews:
            newState = {};
            action.reviews.forEach((review: Review) => {
                newState[review.id] = review
                })
            return newState

        case DELETE_REVIEW:
            newState = {...state}
            delete newState[action.reviewId]
            return newState

        case CREATE_REVIEW:
            newState = {...state}
            newState[action.review.id] = action.review;
            return newState;

        case UPDATE_REVIEW:
            newState = {...state}
            // keep the joined data (user, restaurant, response) the PUT response lacks
            newState[action.review.id] = { ...state[action.review.id], ...action.review };
            return newState;

        case SET_REVIEW_RESPONSE: {
            const existing = state[action.reviewId]
            if (!existing) return state
            return { ...state, [action.reviewId]: { ...existing, response: action.response } }
        }

        case REMOVE_REVIEW_IMAGE: {
            const existing = state[action.reviewId]
            if (!existing) return state
            return {
                ...state,
                [action.reviewId]: {
                    ...existing,
                    reviewImages: (existing.reviewImages || []).filter((image) => image.id !== action.imageId),
                },
            }
        }

        case REMOVE_REVIEW_RESPONSE: {
            const existing = state[action.reviewId]
            if (!existing) return state
            return { ...state, [action.reviewId]: { ...existing, response: null } }
        }

        default:
            return state;
    }
}
export default reviewReducer;
