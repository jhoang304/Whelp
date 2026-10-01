import React, { useState, useEffect } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { deleteReviewImage, fetchReview, updateOneReview } from '../../../store/reviews';
import { useAppDispatch, useAppSelector } from "../../../store";
import { ReviewImage } from "../../../types";
import PageMessage from "../../PageMessage";
import { pageTitle, useDocumentTitle } from "../../../hooks/useDocumentTitle";
import FormErrors from "../../FormErrors";
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

type Status = "loading" | "ready" | "error";

function UpdateReview(): React.JSX.Element {
  const { reviewId, restaurantId } = useParams<UpdateReviewParams>();
  const location = useLocation<UpdateReviewState | undefined>();
  const sessionUser = useAppSelector((state) => state.session.user);
  const oldReview = useAppSelector((state) => state.reviews[+reviewId]);

  const dispatch = useAppDispatch();
  const history = useHistory();

  const [status, setStatus] = useState<Status>("loading");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [review, setReview] = useState<string>("");
  const [rating, setRating] = useState<string>("");
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>(location.state?.notice ?? []);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Which review the inputs were filled from. They are filled once per
  // review: the stored one changes under the form -- removing a photo
  // replaces it -- and filling them again would throw away what is typed.
  const [filledFrom, setFilledFrom] = useState<number | null>(null);

  // The review itself, not the restaurant's first page of reviews, which it
  // may not be on: arriving from the profile page, it usually is not.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    dispatch(fetchReview(reviewId)).then((errors) => {
      if (cancelled) return;
      if (errors) {
        setLoadErrors(errors);
        setStatus("error");
      } else {
        setStatus("ready");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, reviewId]);

  useEffect(() => {
    if (status === "ready" && oldReview && filledFrom !== oldReview.id) {
      setFilledFrom(oldReview.id);
      setReview(oldReview.review);
      setRating(String(oldReview.rating));
    }
  }, [status, oldReview, filledFrom]);

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
      // Shows the photos that did attach as the review's own. If it fails,
      // the messages below still say what happened.
      await dispatch(fetchReview(reviewId));
      setErrors(["Your review was saved, but some photos could not be attached:", ...attachErrors]);
      setIsSubmitting(false);
      return;
    }

    // The edit is saved. The restaurant page loads the restaurant and its
    // reviews for itself, so there is nothing to refresh first, and this
    // form is replaced in the history rather than left for Back to find.
    history.replace(`/single/${restaurantId}`);
  }

  // The form's own title; in every other state, the message's (null).
  const showingForm = status === "ready" && !!oldReview && String(oldReview.restaurant_id) === restaurantId
    && !!sessionUser && oldReview.user_id === sessionUser.id && filledFrom === oldReview.id;
  useDocumentTitle(showingForm && oldReview
    ? pageTitle(oldReview.restaurant ? `Edit your review: ${oldReview.restaurant.name}` : "Edit your review")
    : null);

  const loading = <PageMessage icon="fa-solid fa-spinner fa-spin" title="Loading..." documentTitle="" />;

  if (status === "loading") {
    return loading;
  }

  const notFound = (
    <PageMessage
      icon="fa-regular fa-face-frown"
      title={loadErrors[0] || "We couldn't find that review."}
      action={{ to: "/restaurants", label: "Browse restaurants" }}
    />
  );

  // A review from another restaurant is not this page's to edit either:
  // saving it would send the reader back to the wrong restaurant.
  if (status === "error" || !oldReview || String(oldReview.restaurant_id) !== restaurantId) {
    return notFound;
  }

  if (!sessionUser) {
    return (
      <PageMessage icon="fa-regular fa-user" title="Log in to edit your review" action={{ to: "/login", label: "Log in" }} />
    );
  }

  // Someone else's review looks like any review that isn't there: the page
  // would only offer changes the server refuses.
  if (oldReview.user_id !== sessionUser.id) {
    return notFound;
  }

  // Until the inputs hold this review, rather than paint an empty form.
  if (filledFrom !== oldReview.id) {
    return loading;
  }

    return (
      <div  className="update-review-container">
        <h1>{oldReview.restaurant ? `Edit your review of ${oldReview.restaurant.name}` : "Edit your review"}</h1>
        <form onSubmit={handleSubmit} className="update-new-review-form">
          <FormErrors errors={errors} className="review-form-errors" />
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
