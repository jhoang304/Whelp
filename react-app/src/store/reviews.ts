import { Review, ReviewResponse, ReviewsState } from '../types';

// Load all reviews by restaurantId
const LOAD_ALL_REVIEWS_BY_RESTAURANTID = 'reviews/LOAD_ALL_REVIEWS'
const  loadAllReviewsByRestaurantId = (reviews: Review[]) => {
    return {
        type:LOAD_ALL_REVIEWS_BY_RESTAURANTID,
        reviews
    }
}

export const fetchAllReviewsByRestaurantId = (restaurantId: any) => async(dispatch: any) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/reviews`)
    if(res.ok){
        const reviews = await res.json();
        dispatch(loadAllReviewsByRestaurantId(reviews["reviews"]));
        return reviews;
    }
}


const LoadUserReviews = 'reviews/LoadUserReviews'

const loadUserIdRev = (reviews: Review[]) => ({
  type: LoadUserReviews,
  reviews
})

export const getAllReviewsByUserId = (user_id: any) => async(dispatch: any) => {
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
const deleteReview = (reviewId: any) => {
    return {
        type:DELETE_REVIEW,
        reviewId
    }
}

export const deleteReviewById = (reviewId: any) => async (dispatch: any) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
        method:"DELETE"
    })
    if(res.ok){
        dispatch(deleteReview(reviewId))
    }
}

// Create a review
const CREATE_REVIEW = 'reviews/CREATE_REVIEW'
const createReview = (review: any) => {
    return {
        type:CREATE_REVIEW,
        review
    }
}
export const createOneReview = (newReview: any, restaurantId: any) => async (dispatch: any) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/reviews`, {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body:JSON.stringify(newReview)
    })
    if(res.ok){
        const review = await res.json();
        dispatch(createReview(review));
        return review;
    }
}

//update a review
const UPDATE_REVIEW = 'reviews/UPDATE_REVIEW'
const updateReview = (review: any) => {
    return {
        type:UPDATE_REVIEW,
        review
    }
}
export const updateOneReview = (newReview: any, reviewId: any) => async (dispatch: any) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body:JSON.stringify(newReview)
    })
    if(res.ok){
        const review = await res.json();
        dispatch(updateReview(review))
        return review
    }
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

const errorsFrom = async (res: Response, fallback: string): Promise<string[]> => {
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.errors) ? data.errors : [fallback];
}

/** Post the owner's reply. Returns null on success or a list of error messages. */
export const createReviewResponse = (reviewId: number, response: string) => async (dispatch: any) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
    })
    if (res.ok) {
        dispatch(setReviewResponse(reviewId, await res.json()))
        return null
    }
    return errorsFrom(res, "Could not post your response. Please try again.")
}

/** Edit the owner's reply. Returns null on success or a list of error messages. */
export const updateReviewResponse = (reviewId: number, response: string) => async (dispatch: any) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
    })
    if (res.ok) {
        dispatch(setReviewResponse(reviewId, await res.json()))
        return null
    }
    return errorsFrom(res, "Could not update your response. Please try again.")
}

/** Remove the owner's reply. Returns null on success or a list of error messages. */
export const deleteReviewResponse = (reviewId: number) => async (dispatch: any) => {
    const res = await fetch(`/api/reviews/${reviewId}/response`, { method: "DELETE" })
    if (res.ok) {
        dispatch(removeReviewResponse(reviewId))
        return null
    }
    return errorsFrom(res, "Could not delete your response. Please try again.")
}

const initialState: ReviewsState = {}
const reviewReducer = (state: ReviewsState = initialState, action: any): ReviewsState => {
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
