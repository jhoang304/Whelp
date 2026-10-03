import React, { useEffect, useState } from "react";
import { Redirect, useHistory, useLocation, useParams } from "react-router-dom";
import { CreateReviewResult, createOneReview } from '../../../store/reviews';
import { getSingleRestaurant } from '../../../store/restaurants';
import { useAppDispatch, useAppSelector } from "../../../store";
import { SingleRestaurantResponse } from "../../../types";
import PageMessage from "../../PageMessage";
import { pageTitle, useDocumentTitle } from "../../../hooks/useDocumentTitle";
import ReviewForm from "../ReviewForm";
import ReviewPhotoPicker, { PendingPhoto } from "../ReviewPhotoPicker";
import { attachUploaded, uploadPending } from "../../../utils/reviewPhotos";
import { authLink } from "../../../utils/returnTo";

/** Its cover photo, or failing that its first. */
const coverOf = (restaurant: SingleRestaurantResponse): string | null => {
  const images = restaurant.restaurantImages ?? [];
  return (images.find((image) => image.preview) ?? images[0])?.url ?? null;
};

interface CreateNewReviewParams {
  restaurantId: string;
}

type Status = "loading" | "ready" | "error";

function CreateNewReview(): React.JSX.Element {
  const { restaurantId } = useParams<CreateNewReviewParams>();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const location = useLocation();

  const sessionUser = useAppSelector((state) => state.session.user);
  const loaded = useAppSelector((state) => state.Restaurants.singleRestaurant);
  // The store keeps whichever restaurant was opened last; only this one will do.
  const restaurant = loaded && String(loaded.id) === restaurantId ? loaded : undefined;

  const [status, setStatus] = useState<Status>("loading");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [review, setReview] = useState<string>("");
  // None until the reader picks one: it started at 3, and every review
  // whose writer didn't notice was a 3 (#132).
  const [rating, setRating] = useState<number | null>(null);
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

  // The form has checked there is a rating and something to say.
  const send = async (trimmed: string, stars: number) => {
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
        createOneReview({ review: trimmed, rating: stars }, +restaurantId)
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
      <PageMessage icon="fa-regular fa-user" title="Log in to write a review" action={{ to: authLink("/login", location), label: "Log in" }}>
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
    <ReviewForm
      title={`Write a review for ${restaurant.name}`}
      restaurant={{ id: restaurant.id, name: restaurant.name, city: restaurant.city, state: restaurant.state, cover: coverOf(restaurant) }}
      review={review}
      onReviewChange={setReview}
      rating={rating}
      onRatingChange={setRating}
      errors={errors}
      onErrors={setErrors}
      onSubmit={send}
      submitLabel="Post review"
      busy={isSubmitting}
      busyLabel={pending.length ? "Uploading photos..." : "Posting..."}
    >
      <ReviewPhotoPicker pending={pending} onPendingChange={setPending} disabled={isSubmitting} />
    </ReviewForm>
  );
}

export default CreateNewReview
