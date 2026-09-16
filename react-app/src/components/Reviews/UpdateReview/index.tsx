import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, useParams } from "react-router-dom";
import { updateOneReview, fetchAllReviewsByRestaurantId } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { AppDispatch } from "../../../store";
import { RootState } from "../../../types";
import './UpdateReview.css'

/** Matches the `review` column and ReviewForm's Length validator. */
export const MAX_REVIEW_LENGTH = 255;

interface UpdateReviewParams {
  reviewId: string;
  restaurantId: string;
}

function UpdateReview(): React.JSX.Element {
  const { reviewId, restaurantId } = useParams<UpdateReviewParams>();
  const oldReview = useSelector((state: RootState) => state.reviews[+reviewId]);

  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();

  // The review may not be in the store yet (e.g. arriving from the profile page).
  const [review, setReview] = useState<string>(oldReview ? oldReview.review : "");
  const [rating, setRating] = useState<string>(oldReview ? String(oldReview.rating) : "5");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect( () => {
    dispatch(getSingleRestaurant(+restaurantId) as any);
    if (!oldReview) dispatch(fetchAllReviewsByRestaurantId(+restaurantId) as any);
  }, [dispatch, restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (oldReview) {
      setReview(oldReview.review);
      setRating(String(oldReview.rating));
    }
  }, [oldReview]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = review.trim();
    const validationErrors: string[] = [];

    if (!trimmed) validationErrors.push("Review is required.")
    else if (trimmed.length > MAX_REVIEW_LENGTH) validationErrors.push(`Reviews must be between 1 and ${MAX_REVIEW_LENGTH} characters.`)

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    // The thunk returns the API's messages instead of throwing, so a rejected
    // edit (someone else's review, expired session) has to be shown here
    // rather than redirecting as though it had saved.
    const failures: string[] | null = await dispatch(
      updateOneReview({ review: trimmed, rating }, reviewId) as any
    );

    if (failures) {
      setErrors(failures);
      setIsSubmitting(false);
      return;
    }

    await dispatch(fetchAllReviewsByRestaurantId(+restaurantId) as any);
    await dispatch(getSingleRestaurant(+restaurantId) as any);
    history.push(`/single/${restaurantId}`);
  }

    return (
      <div  className="update-review-container">
        <h2>Update Review</h2>
        <form onSubmit={handleSubmit} className="update-new-review-form">
          <ul>
            {errors.map((error, idx) => <li key={idx}>{error}</li>)}
          </ul>
          <label>
            <span>review:</span>
            <input
              type="text"
              value={review}
              onChange={e => setReview(e.target.value)}
              maxLength={MAX_REVIEW_LENGTH}
              required
            />
          </label>
          <label>
          <span>rating:</span>
            <select onChange={e => setRating(e.target.value)} value={rating}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          </label>
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit"}</button>
        </form>
      </div>
    )
}

export default UpdateReview
