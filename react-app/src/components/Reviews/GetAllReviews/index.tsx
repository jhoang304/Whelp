import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  fetchAllReviewsByRestaurantId,
  deleteReviewById,
  REVIEW_SORTS,
  ReviewSort,
} from "../../../store/reviews";
import { getSingleRestaurant } from "../../../store/restaurants";
import { useAppDispatch, useAppSelector } from "../../../store";
import { Review } from "../../../types";
import RatingStar from "../../RatingStar";
import OwnerResponse from "../OwnerResponse";
import ReviewPhotos from "../ReviewPhotos";
import OpenModalButton from "../../OpenModalButton";
import ConfirmDeleteModal from "../../ConfirmDeleteModal";
import { avatarUrl, onAvatarError } from "../../../utils/images";
import "./GetAllReviews.css";
import "../../RowActions/RowActions.css";
import "../../../styles/show-more.css";

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

  const sessionUser = useAppSelector((state) => state.session.user);
  const currentRestaurant = useAppSelector((state) => state.Restaurants.singleRestaurant);
  const allReviews = useAppSelector((state) => state.reviews);

  const [sort, setSort] = useState<ReviewSort>("newest");
  const [order, setOrder] = useState<number[]>([]);
  const [total, setTotal] = useState<number>(0);
  // Whether a first page has come back. Until then the list is empty only
  // because it hasn't arrived, not because there are no reviews.
  const [loaded, setLoaded] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // A page that couldn't be loaded. The first one failing used to read as
  // "No reviews yet. Be the first", under a header counting them (#116).
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [moreFailed, setMoreFailed] = useState<boolean>(false);
  // Bumped by Try again, to ask for the same page again.
  const [attempt, setAttempt] = useState<number>(0);
  // Counts each time the list starts over, for a new restaurant or sort. An
  // answer to a request made before -- a slower first page, or a Show more
  // still on its way -- is then dropped rather than mixed into this list.
  const listVersion = useRef<number>(0);

  useEffect(() => {
    const version = ++listVersion.current;
    setLoadingMore(false);
    setLoadFailed(false);
    setMoreFailed(false);
    // The API decides the order now, and the store is keyed by id, so keep
    // the ids it returned: re-sorting a page of "highest rated" by date here
    // would quietly undo the sort the reader asked for.
    dispatch(fetchAllReviewsByRestaurantId(restaurantId, sort)).then((page) => {
      if (version !== listVersion.current) return;
      if (!page) {
        setLoadFailed(true);
        return;
      }
      setOrder(page.items.map((review) => review.id));
      setTotal(page.total);
      setLoaded(true);
    });
  }, [dispatch, restaurantId, sort, attempt]);

  const reviews: Review[] = order
    .map((id) => allReviews[id])
    .filter((review): review is Review =>
      !!review && String(review.restaurant_id) === String(restaurantId));

  const isOwner = !!sessionUser && !!currentRestaurant && sessionUser.id === currentRestaurant.user_id;
  // Asked of the server rather than looked for among the reviews shown: the
  // restaurant's answer is there before the first page of reviews is, and
  // "Write a review" would otherwise offer a second one the server refuses.
  const viewerReviewId = (sessionUser && currentRestaurant?.viewerReviewId) || null;

  const showMore = async () => {
    const version = listVersion.current;
    setLoadingMore(true);
    setMoreFailed(false);
    // What comes after the reviews still here. Deleting yours takes it off
    // the server's list too, so this count is where the rest start.
    const page = await dispatch(fetchAllReviewsByRestaurantId(restaurantId, sort, reviews.length));
    if (version !== listVersion.current) return;
    setLoadingMore(false);
    if (!page) {
      setMoreFailed(true);
      return;
    }
    // A review posted since moves the rest down one, so one can arrive
    // twice; keep the first copy.
    const fresh = page.items.map((review) => review.id).filter((id) => !order.includes(id));
    setOrder((current) => [...current, ...fresh]);
    // Nothing new means the end, even if the count says otherwise: the new
    // review is counted, but sits above the pages already shown.
    setTotal(fresh.length ? page.total : reviews.length);
  };

  // Resolves to the messages when the delete was refused, which the dialog
  // shows instead of closing (#116).
  const handleDelete = (reviewId: number) => async () => {
    const failures = await dispatch(deleteReviewById(reviewId));
    if (failures) return failures;
    // The restaurant first, for its rating and for viewerReviewId: until it
    // says you have no review, "Write a review" is not offered.
    await dispatch(getSingleRestaurant(+restaurantId));
    // The rest stay as they are; the next Show more starts after them.
    setOrder((current) => current.filter((id) => id !== reviewId));
    setTotal((count) => Math.max(count - 1, 0));
    return null;
  };

  return (
    <div className="reviews-container">
      <div className="reviews-heading">
        <h2>Reviews</h2>
        <div className="reviews-heading-actions">
          {reviews.length > 1 && (
            <label className="reviews-sort">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as ReviewSort)}
              >
                {REVIEW_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
          {sessionUser && !isOwner && !viewerReviewId && (
            // Up here, not under the list: with many reviews the bottom is a
            // long way down, and past every Show more. A link that looks like
            // a button, not a button inside a link: the two nested are two
            // stops for Tab and two things for a screen reader to announce,
            // and HTML does not allow it.
            <Link className="red-button" to={`/${restaurantId}/create-review`}>
              {whiteStar}
              <span className="write-a-review">Write a review</span>
            </Link>
          )}
        </div>
      </div>

      {loadFailed && (
        <div className="reviews-error" role="alert">
          <p>We couldn't load the reviews.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}

      {loaded && !loadFailed && reviews.length === 0 && (
        <p className="reviews-empty">No reviews yet. Be the first to share your experience.</p>
      )}

      {reviews.map((review) => {
        const isAuthor = !!sessionUser && review.user_id === sessionUser.id;
        return (
          // Yours comes first in every order (the API puts it there), set
          // apart so it is the first thing you find.
          <div className={`single-review-container${isAuthor ? " your-review" : ""}`} key={review.id}>
            <div className="single-review">
              {isAuthor && <div className="your-review-label">Your review</div>}
              <div className="review-user-data">
                <img
                  className="review-photo"
                  src={avatarUrl(review.user)}
                  alt=""
                  onError={onAvatarError}
                />
                <div className="review-right-section">
                  {review.user ? (
                    <NavLink className="review-user-name" to={`/users/get/${review.user_id}`}>
                      {review.user.username}
                    </NavLink>
                  ) : (
                    // Its author deleted their account. The review stays, as
                    // part of the rating, but there is no profile to link to.
                    <span className="review-deleted-user">Deleted user</span>
                  )}
                  <div className="review-time">
                    {new Date(review.createdAt).toLocaleDateString("en-US", DATE_OPTIONS)}
                  </div>
                  <div>
                    <RatingStar size="15" rating={review.rating} />
                  </div>
                </div>
                {/* The author's Edit and Delete, in the review's own header
                    and in the same style as the owner's reply below. */}
                {isAuthor && (
                  <div className="review-actions row-actions">
                    <Link to={`/${restaurantId}/reviews/${review.id}/update`} aria-label="Edit your review">
                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                      Edit
                    </Link>
                    <OpenModalButton
                      className="danger"
                      ariaLabel="Delete your review"
                      buttonText={<><i className="fa-solid fa-trash" aria-hidden="true"></i>Delete</>}
                      modalComponent={
                        <ConfirmDeleteModal
                          title="Delete Review"
                          message="Delete your review?"
                          detail="This cannot be undone. Its photos go with it."
                          confirmLabel="Delete Review"
                          onConfirm={handleDelete(review.id)}
                        />
                      }
                    />
                  </div>
                )}
              </div>
              <div className="review-body">{review.review}</div>
              <ReviewPhotos
                photos={review.reviewImages}
                author={review.user ? review.user.username : undefined}
              />
              <OwnerResponse
                review={review}
                canManage={isOwner}
                businessName={currentRestaurant ? currentRestaurant.name : undefined}
              />
            </div>
          </div>
        );
      })}

      {reviews.length < total && (
        <div className="show-more">
          <button
            type="button"
            className="show-more-button"
            onClick={showMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : `Show more reviews (${reviews.length} of ${total})`}
          </button>
          {moreFailed && (
            <p className="show-more-error" role="alert">We couldn't load more reviews. Please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GetAllReviews;
