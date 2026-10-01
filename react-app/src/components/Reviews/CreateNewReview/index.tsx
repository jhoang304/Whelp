import React, { useEffect, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router-dom";
import { CreateReviewResult, createOneReview } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { useAppDispatch, useAppSelector } from "../../../store";
import PageMessage from "../../PageMessage";
import { pageTitle, useDocumentTitle } from "../../../hooks/useDocumentTitle";
import FormErrors from "../../FormErrors";
import ReviewPhotoPicker, { PendingPhoto } from "../ReviewPhotoPicker";
import { attachUploaded, uploadPending } from "../../../utils/reviewPhotos";
import './CreateNewReview.css'

/** Matches the `review` column and ReviewForm's Length validator. */
export const MAX_REVIEW_LENGTH = 255;

interface CreateNewReviewParams {
  restaurantId: string;
}

type Status = "loading" | "ready" | "error";

function CreateNewReview(): React.JSX.Element {
  const { restaurantId } = useParams<CreateNewReviewParams>();
  const dispatch = useAppDispatch();
  const history = useHistory();

  const sessionUser = useAppSelector((state) => state.session.user);
  const loaded = useAppSelector((state) => state.Restaurants.singleRestaurant);
  // The store keeps whichever restaurant was opened last; only this one will do.
  const restaurant = loaded && String(loaded.id) === restaurantId ? loaded : undefined;

  const [status, setStatus] = useState<Status>("loading");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [review, setReview] = useState<string>("");
  const [rating, setRating] = useState<string>("3");
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // The restaurant first: whether it exists, whose it is and whether this
  // reader has reviewed it already all decide what the page shows, and the
  // server would otherwise say so only after the review, and its photos,
  // were written.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    dispatch(getSingleRestaurant(+restaurantId)).then((errors: string[] | null) => {
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
  }, [dispatch, restaurantId]);

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

    // The review exists now, so this form has done its job: replace it in
    // the history rather than push past it, or Back returns to an empty form
    // the server would refuse. Nothing is refreshed first -- the restaurant
    // page loads the restaurant and its reviews for itself.
    if (attachErrors.length > 0) {
      // Submitting this form again would only be told it is a second review.
      // The edit page can add the rest, and it says why they are missing.
      history.replace(`/${restaurantId}/reviews/${result.review.id}/update`, {
        notice: ["Your review was posted, but some photos could not be attached:", ...attachErrors],
      });
      return;
    }

    history.replace(`/single/${restaurantId}`);
  }

  // The form's own title; in every other state, the message's (null).
  const showingForm = status === "ready" && !!restaurant && !!sessionUser
    && sessionUser.id !== restaurant.user_id && !restaurant.viewerReviewId;
  useDocumentTitle(showingForm && restaurant ? pageTitle(`Write a review: ${restaurant.name}`) : null);

  if (status === "loading") {
    return <PageMessage icon="fa-solid fa-spinner fa-spin" title="Loading..." documentTitle="" />;
  }

  if (status === "error" || !restaurant) {
    return (
      <PageMessage
        icon="fa-regular fa-face-frown"
        title={loadErrors[0] || "We couldn't find that restaurant."}
        action={{ to: "/restaurants", label: "Browse restaurants" }}
      />
    );
  }

  const backToRestaurant = { to: `/single/${restaurant.id}`, label: `Back to ${restaurant.name}` };

  if (!sessionUser) {
    return (
      <PageMessage icon="fa-regular fa-user" title="Log in to write a review" action={{ to: "/login", label: "Log in" }}>
        You need an account to review {restaurant.name}.
      </PageMessage>
    );
  }

  if (sessionUser.id === restaurant.user_id) {
    return (
      <PageMessage icon="fa-solid fa-store" title="You can't review your own restaurant" action={backToRestaurant}>
        You can reply to the reviews {restaurant.name} gets from its page instead.
      </PageMessage>
    );
  }

  // One review per restaurant: take them to theirs.
  if (restaurant.viewerReviewId) {
    return <Redirect to={`/${restaurant.id}/reviews/${restaurant.viewerReviewId}/update`} />;
  }

    return (
      <div  className="create-review-container">
        <h1>Write a review for {restaurant.name}</h1>
        <form onSubmit={handleSubmit} className="create-new-review-form">
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
          <ReviewPhotoPicker pending={pending} onPendingChange={setPending} disabled={isSubmitting} />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (pending.length ? "Uploading photos..." : "Submitting...") : "Submit"}
          </button>
        </form>
      </div>
    )
}

export default CreateNewReview
