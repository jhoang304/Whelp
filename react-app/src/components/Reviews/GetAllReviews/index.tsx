import React, { useEffect } from "react";
import { NavLink, useHistory } from "react-router-dom";
import {
  fetchAllReviewsByRestaurantId,
  deleteReviewById,
} from "../../../store/reviews";
import { getSingleRestaurant } from "../../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../../store";
import { Review } from "../../../types";
import RatingStar from "../../RatingStar";
import OwnerResponse from "../OwnerResponse";
import { avatarUrl, onAvatarError } from "../../../utils/images";
import "./GetAllReviews.css";

interface GetAllReviewsProps {
  restaurantId: string | number;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

const whiteStar = (
  <svg width="24" height="24" className="white-star">
    <path d="M17.87 22a.93.93 0 01-.46-.12L12 19.08l-5.41 2.84a1 1 0 01-1-.08 1 1 0 01-.4-1l1-6-4.39-4.26a1 1 0 01.56-1.7L8.4 8l2.7-5.48a1 1 0 011.8 0L15.6 8l6 .88a1 1 0 01.56 1.7l-4.38 4.27 1 6a1 1 0 01-1 1.17l.09-.02zM12 17c.163.002.323.04.47.11l4.07 2.15-.78-4.54a1 1 0 01.29-.89l3.3-3.21-4.56-.72a1 1 0 01-.79-.54l-2-4.14-2 4.14a1 1 0 01-.75.54l-4.56.67L8 13.78a1 1 0 01.29.89l-.78 4.54 4.07-2.15A1.12 1.12 0 0112 17z"></path>
  </svg>
);

function GetAllReviews({ restaurantId }: GetAllReviewsProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const history = useHistory();

  const sessionUser = useAppSelector((state) => state.session.user);
  const currentRestaurant = useAppSelector((state) => state.Restaurants.singleRestaurant);
  const allReviews = useAppSelector((state) => state.reviews);

  useEffect(() => {
    dispatch(fetchAllReviewsByRestaurantId(restaurantId));
  }, [dispatch, restaurantId]);

  // Object keys come back in numeric order, so re-sort newest first.
  const reviews: Review[] = Object.values(allReviews)
    .filter((review) => String(review.restaurant_id) === String(restaurantId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);

  const isOwner = !!sessionUser && !!currentRestaurant && sessionUser.id === currentRestaurant.user_id;
  const hasReviewed = !!sessionUser && reviews.some((review) => review.user_id === sessionUser.id);

  const handleDelete = (reviewId: number) => async () => {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    await dispatch(deleteReviewById(reviewId));
    await dispatch(fetchAllReviewsByRestaurantId(restaurantId));
    dispatch(getSingleRestaurant(+restaurantId));
  };

  const handleUpdate = (reviewId: number) => () => {
    history.push(`/${restaurantId}/reviews/${reviewId}/update`);
  };

  return (
    <div className="reviews-container">
      <h2>Reviews</h2>

      {reviews.length === 0 && (
        <p className="reviews-empty">No reviews yet. Be the first to share your experience.</p>
      )}

      {reviews.map((review) => {
        const isAuthor = !!sessionUser && review.user_id === sessionUser.id;
        return (
          <div className="single-review-container" key={review.id}>
            <div className="single-review">
              <div className="review-user-data">
                <img
                  className="review-photo"
                  src={avatarUrl(review.user)}
                  alt=""
                  onError={onAvatarError}
                />
                <div className="review-right-section">
                  <NavLink id="review-user-name" to={`/users/get/${review.user_id}`}>
                    {review.user ? review.user.username : "Whelp user"}
                  </NavLink>
                  <div className="review-time">
                    {new Date(review.createdAt).toLocaleDateString("en-US", DATE_OPTIONS)}
                  </div>
                  <div>
                    <RatingStar size="15" rating={review.rating} />
                  </div>
                </div>
              </div>
              <div className="review-body">{review.review}</div>
              <OwnerResponse
                review={review}
                canManage={isOwner}
                businessName={currentRestaurant ? currentRestaurant.name : undefined}
              />
            </div>
            {isAuthor && (
              <div className="delete-update">
                <button className="update-review red-button" onClick={handleUpdate(review.id)}>
                  <span className="update-review-text">Update Review</span>
                </button>
                <button className="delete-review red-button" onClick={handleDelete(review.id)}>
                  <span className="delete-review-text">Delete Review</span>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {sessionUser && !isOwner && !hasReviewed && (
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

export default GetAllReviews;
