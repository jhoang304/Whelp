import React, { useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { CreateReviewResult, createOneReview, fetchAllReviewsByRestaurantId } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { useAppDispatch } from "../../../store";
import ReviewPhotoPicker, { PendingPhoto } from "../ReviewPhotoPicker";
import { attachUploaded, uploadPending } from "../../../utils/reviewPhotos";
import './CreateNewReview.css'

/** Matches the `review` column and ReviewForm's Length validator. */
export const MAX_REVIEW_LENGTH = 255;

interface CreateNewReviewParams {
  restaurantId: string;
}

function CreateNewReview(): React.JSX.Element {
  const { restaurantId } = useParams<CreateNewReviewParams>();
  const dispatch = useAppDispatch();
  const history = useHistory();

  const [review, setReview] = useState<string>("");
  const [rating, setRating] = useState<string>("3");
  const [pending, setPending] = useState<PendingPhoto[]>([]);
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

    // Photos go up before the review exists: uploading is the step that
    // realistically fails, and failing here leaves nothing to undo.
    const { uploaded, errors: uploadErrors } = await uploadPending(pending);
    if (uploadErrors) {
      setErrors(uploadErrors);
      setIsSubmitting(false);
      return;
    }

    // The thunk returns the API's messages instead of throwing, so a rejected
    // review (already reviewed, own restaurant, expired session) has to be
    // shown here rather than silently redirecting. The catch is the backstop
    // for anything it cannot turn into messages, such as a 200 whose body is
    // not JSON: every path that stays on this page must re-enable the form.
    let result: CreateReviewResult;
    try {
      result = await dispatch(
        createOneReview({ review: trimmed, rating: Number(rating) }, +restaurantId)
      );
    } catch (unexpected) {
      result = { errors: ["Something went wrong posting your review. Please try again."] };
    }

    if (result.errors) {
      setErrors(result.errors);
      setIsSubmitting(false);
      return;
    }

    const { errors: attachErrors } = await attachUploaded(dispatch, result.review.id, uploaded);

    // The review is saved. Refreshing is best effort: if the connection drops
    // here, the restaurant page loads for itself and reports its own errors,
    // which beats stranding the user on a disabled form.
    try {
      await dispatch(getSingleRestaurant(+restaurantId));
      await dispatch(fetchAllReviewsByRestaurantId(+restaurantId));
    } catch (refreshError) {
      // fall through to the restaurant page
    }

    if (attachErrors.length > 0) {
      // The review exists now, so submitting this form again would only be
      // told it is a second review. The edit page can add the rest, and it
      // says why they are missing.
      history.push(`/${restaurantId}/reviews/${result.review.id}/update`, {
        notice: ["Your review was posted, but some photos could not be attached:", ...attachErrors],
      });
      return;
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
          <ReviewPhotoPicker pending={pending} onPendingChange={setPending} disabled={isSubmitting} />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (pending.length ? "Uploading photos..." : "Submitting...") : "Submit"}
          </button>
        </form>
      </div>
    )
}

export default CreateNewReview
