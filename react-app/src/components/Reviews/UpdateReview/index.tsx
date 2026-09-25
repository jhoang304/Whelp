import React, { useState, useEffect } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { deleteReviewImage, updateOneReview, fetchAllReviewsByRestaurantId } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { useAppDispatch, useAppSelector } from "../../../store";
import { ReviewImage } from "../../../types";
import ReviewPhotoPicker, { PendingPhoto } from "../ReviewPhotoPicker";
import { attachUploaded, uploadPending } from "../../../utils/reviewPhotos";
import './UpdateReview.css'

/** Matches the `review` column and ReviewForm's Length validator. */
export const MAX_REVIEW_LENGTH = 255;

interface UpdateReviewParams {
  reviewId: string;
  restaurantId: string;
}

/** What the create form hands over when some photos did not make it. */
interface UpdateReviewState {
  notice?: string[];
}

function UpdateReview(): React.JSX.Element {
  const { reviewId, restaurantId } = useParams<UpdateReviewParams>();
  const location = useLocation<UpdateReviewState | undefined>();
  const oldReview = useAppSelector((state) => state.reviews[+reviewId]);

  const dispatch = useAppDispatch();
  const history = useHistory();

  // The review may not be in the store yet (e.g. arriving from the profile page).
  const [review, setReview] = useState<string>(oldReview ? oldReview.review : "");
  const [rating, setRating] = useState<string>(oldReview ? String(oldReview.rating) : "5");
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>(location.state?.notice ?? []);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect( () => {
    dispatch(getSingleRestaurant(+restaurantId));
    if (!oldReview) dispatch(fetchAllReviewsByRestaurantId(+restaurantId));
  }, [dispatch, restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (oldReview) {
      setReview(oldReview.review);
      setRating(String(oldReview.rating));
    }
  }, [oldReview]);

  // Removing a photo the review already has takes effect at once, the way
  // "Remove Photo" does in the restaurant's photo modal, rather than waiting
  // for Submit: it is its own request, and pretending otherwise would mean a
  // reader who leaves without saving finds the photo gone anyway.
  const handleRemoveExisting = async (image: ReviewImage) => {
    setErrors([]);
    setRemovingId(image.id);
    try {
      const failures = await dispatch(deleteReviewImage(+reviewId, image.id));
      if (failures) setErrors(failures);
    } catch (unexpected) {
      setErrors(["Something went wrong removing the photo. Please try again."]);
    } finally {
      setRemovingId(null);
    }
  };

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

    // Photos go up first, so a file the server refuses stops everything
    // before the edit is saved.
    const { uploaded, errors: uploadErrors } = await uploadPending(pending);
    if (uploadErrors) {
      setErrors(uploadErrors);
      setIsSubmitting(false);
      return;
    }

    // The thunk returns the API's messages instead of throwing, so a rejected
    // edit (someone else's review, expired session) has to be shown here
    // rather than redirecting as though it had saved. The catch is the
    // backstop for anything it cannot turn into messages, such as a 200 whose
    // body is not JSON: every path that stays on this page must re-enable the
    // form.
    let failures: string[] | null;
    try {
      failures = await dispatch(
        updateOneReview({ review: trimmed, rating: Number(rating) }, reviewId)
      );
    } catch (unexpected) {
      failures = ["Something went wrong saving your review. Please try again."];
    }

    if (failures) {
      setErrors(failures);
      setIsSubmitting(false);
      return;
    }

    const { failed, errors: attachErrors } = await attachUploaded(dispatch, reviewId, uploaded);
    if (attachErrors.length > 0) {
      // Keep only the photos that did not arrive, so trying again cannot
      // attach the others a second time, and show the rest as the review's.
      pending
        .filter((photo) => !failed.includes(photo))
        .forEach((photo) => URL.revokeObjectURL(photo.preview));
      setPending(failed);
      try {
        await dispatch(fetchAllReviewsByRestaurantId(+restaurantId));
      } catch (refreshError) {
        // the messages below still say what happened
      }
      setErrors(["Your review was saved, but some photos could not be attached:", ...attachErrors]);
      setIsSubmitting(false);
      return;
    }

    // The edit is saved. Refreshing is best effort: if the connection drops
    // here, the restaurant page loads for itself and reports its own errors,
    // which beats stranding the user on a disabled form.
    try {
      await dispatch(fetchAllReviewsByRestaurantId(+restaurantId));
      await dispatch(getSingleRestaurant(+restaurantId));
    } catch (refreshError) {
      // fall through to the restaurant page
    }

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
          <ReviewPhotoPicker
            pending={pending}
            onPendingChange={setPending}
            existing={oldReview?.reviewImages ?? []}
            onRemoveExisting={handleRemoveExisting}
            removingId={removingId}
            disabled={isSubmitting}
          />
          <button type="submit" disabled={isSubmitting || removingId !== null}>
            {isSubmitting ? (pending.length ? "Uploading photos..." : "Submitting...") : "Submit"}
          </button>
        </form>
      </div>
    )
}

export default UpdateReview
