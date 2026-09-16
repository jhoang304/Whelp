import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useHistory, useParams } from "react-router-dom";
import { createOneReview, fetchAllReviewsByRestaurantId } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { AppDispatch } from "../../../store";
import './CreateNewReview.css'

/** Matches the `review` column and ReviewForm's Length validator. */
export const MAX_REVIEW_LENGTH = 255;

interface CreateNewReviewParams {
  restaurantId: string;
}

function CreateNewReview(): React.JSX.Element {
  const { restaurantId } = useParams<CreateNewReviewParams>();
  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();

  const [review, setReview] = useState<string>("");
  const [rating, setRating] = useState<string>("3");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
    // review (already reviewed, own restaurant, expired session) has to be
    // shown here rather than silently redirecting. The catch is the backstop
    // for anything it cannot turn into messages, such as a 200 whose body is
    // not JSON: every path that stays on this page must re-enable the form.
    let failures: string[] | null;
    try {
      failures = await dispatch(
        createOneReview({ review: trimmed, rating }, +restaurantId) as any
      );
    } catch (unexpected) {
      failures = ["Something went wrong posting your review. Please try again."];
    }

    if (failures) {
      setErrors(failures);
      setIsSubmitting(false);
      return;
    }

    // The review is saved. Refreshing is best effort: if the connection drops
    // here, the restaurant page loads for itself and reports its own errors,
    // which beats stranding the user on a disabled form.
    try {
      await dispatch(getSingleRestaurant(+restaurantId) as any);
      await dispatch(fetchAllReviewsByRestaurantId(+restaurantId) as any);
    } catch (refreshError) {
      // fall through to the restaurant page
    }

    history.push(`/single/${restaurantId}`);
  }

    return (
      <div  className="create-review-container">
        <h2>Write a Review</h2>
        <form onSubmit={handleSubmit} className="create-new-review-form">
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

export default CreateNewReview
