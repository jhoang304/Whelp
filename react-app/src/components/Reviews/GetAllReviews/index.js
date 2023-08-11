import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { NavLink } from "react-router-dom";
import {
  fetchAllReviewsByRestaurantId,
  deleteReviewById,
} from "../../../store/reviews";
import "./GetAllReviews.css";
import RatingStar from "../../RatingStar";

function GetAllReviews({ restaurantId }) {
  const dispatch = useDispatch();
  const history = useHistory();

  const sessionUser = useSelector((state) => {
    return state.session.user;
  });
  const currentRestaurant = useSelector(
    (state) => state.Restaurants.singleRestaurant
  );

  const allReviews = useSelector((state) => {
    return state.reviews;
  });

  useEffect(() => {
    dispatch(fetchAllReviewsByRestaurantId(restaurantId));
  }, [dispatch]);
  const reviews = Object.values(allReviews);

  let userReview = null;
  let isOwnedBySessionUser = false;
  if (sessionUser) {
    userReview = reviews.filter((review) => review.user.id === sessionUser.id);
    isOwnedBySessionUser = sessionUser.id === currentRestaurant.User.id;
  }

  const handleDelete = (reviewId, restaurantId) => async (e) => {
    await dispatch(deleteReviewById(reviewId)).then(() =>
      dispatch(fetchAllReviewsByRestaurantId(restaurantId))
    );
    history.push(`/single/${restaurantId}`);
  };

  const handleUpdate = (review, reviewId) => async (e) => {
    history.push(`/${restaurantId}/reviews/${reviewId}/update`);
  };

  const options = { year: "numeric", month: "long" };

  let whiteStar = (
    <svg width="24" height="24" class="white-star">
      <path d="M17.87 22a.93.93 0 01-.46-.12L12 19.08l-5.41 2.84a1 1 0 01-1-.08 1 1 0 01-.4-1l1-6-4.39-4.26a1 1 0 01.56-1.7L8.4 8l2.7-5.48a1 1 0 011.8 0L15.6 8l6 .88a1 1 0 01.56 1.7l-4.38 4.27 1 6a1 1 0 01-1 1.17l.09-.02zM12 17c.163.002.323.04.47.11l4.07 2.15-.78-4.54a1 1 0 01.29-.89l3.3-3.21-4.56-.72a1 1 0 01-.79-.54l-2-4.14-2 4.14a1 1 0 01-.75.54l-4.56.67L8 13.78a1 1 0 01.29.89l-.78 4.54 4.07-2.15A1.12 1.12 0 0112 17z"></path>
    </svg>
  );
  return (
    <div className="reviews-container">
      <h2>Reviews</h2>

      {reviews.map((review) => (
        <div className="single-review-container" key={review.id}>
          <div className="single-review">
            <div className="review-user-data">
              <img className="review-photo" src={review.user.portrait} alt="" />
              <div className="review-right-section">
                <NavLink
                  id="review-user-name"
                  to={`/users/get/${review.user_id}`}
                >
                  {review.user.username}
                </NavLink>
                <div className="review-time">
                  {new Date(review.updatedAt).toLocaleDateString(
                    "en-US",
                    options
                  )}
                </div>
                <div>
                  <RatingStar size="15" rating={review.rating} />
                </div>
              </div>
            </div>
            <div className="review-body">Review: {review.review}</div>
          </div>
          <div className="delete-update">
            {sessionUser && review.user.id === sessionUser.id ? (
              <button
                className="delete-review red-button"
                onClick={handleDelete(review.id, restaurantId)}
              >
                {whiteStar}
                <span className="delete-review-text">Delete Review</span>
              </button>
            ) : (
              ""
            )}
            {sessionUser && review.user.id === sessionUser.id ? (
              <button
                className="update-review red-button"
                onClick={handleUpdate(review, review.id)}
              >
                {whiteStar}
                <span className="update-review-text">Update Review</span>
              </button>
            ) : (
              ""
            )}
          </div>
        </div>
      ))}
      {sessionUser && !isOwnedBySessionUser && !userReview.length && (
        <NavLink to={`/${restaurantId}/create-review`}>
          <button className="red-button">
            {whiteStar}
            <span className="write-a-review">Write a review</span>
          </button>
        </NavLink>
      )}
    </div>
  );
}

export default GetAllReviews
