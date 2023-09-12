// Load all reviews by restaurantId
const LOAD_ALL_REVIEWS_BY_RESTAURANTID = 'reviews/LOAD_ALL_REVIEWS'
const  loadAllReviewsByRestaurantId = (reviews) => {
    return {
        type:LOAD_ALL_REVIEWS_BY_RESTAURANTID,
        reviews
    }
}

export const fetchAllReviewsByRestaurantId = (restaurantId) => async(dispatch) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/reviews`)
    if(res.ok){
        const reviews = await res.json();
        dispatch(loadAllReviewsByRestaurantId(reviews["reviews"]));
        return reviews;
    }
}


const LoadUserReviews = 'reviews/LoadUserReviews'

const loadUserIdRev = (reviews) => ({
  type: LoadUserReviews,
  reviews
})

export const getAllReviewsByUserId = (user_id) => async(dispatch) => {
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
const deleteReview = (reviewId) => {
    return {
        type:DELETE_REVIEW,
        reviewId
    }
}

export const deleteReviewById = (reviewId) => async (dispatch) => {
    const res = await fetch(`/api/reviews/${reviewId}`, {
        method:"DELETE"
    })
    if(res.ok){
        dispatch(deleteReview(reviewId))
    }
}

// Create a review
const CREATE_REVIEW = 'reviews/CREATE_REVIEW'
const createReview = (review) => {
    return {
        type:CREATE_REVIEW,
        review
    }
}
export const createOneReview = (newReview,restaurantId) => async (dispatch) => {
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
const updateReview = (review) => {
    return {
        type:UPDATE_REVIEW,
        review
    }
}
export const updateOneReview = (newReview, reviewId) => async (dispatch) => {
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

const initialState = {}
const reviewReducer = (state = initialState, action) => {
    let newState
    switch (action.type) {
        case LOAD_ALL_REVIEWS_BY_RESTAURANTID:
            newState = {};
            const allReviews = action.reviews
            allReviews.forEach(review =>{
                newState[review["id"]] = review
            })
            return newState

        case LoadUserReviews:
            newState = {};
            action.reviews.forEach(review => {
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
            newState[action.review.id] = action.review;
            return newState;

        default:
            return state;
    }
}
export default reviewReducer;
