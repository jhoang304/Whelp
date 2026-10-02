import React, { useId, useRef } from "react";
import { Link } from "react-router-dom";
import FormErrors from "../../FormErrors";
import StarPicker from "../StarPicker";
import { MAX_REVIEW_LENGTH } from "../../../store/reviews";
import { DEFAULT_RESTAURANT_IMAGE, onRestaurantImageError } from "../../../utils/images";
import "./ReviewForm.css";

/** "1,234": the count and the limit run to four digits (#133). */
const count = (n: number): string => n.toLocaleString("en-US");

/**
 * Where the count turns red: the last tenth. Twenty-five characters' warning
 * was enough at 255, and none at all at 5,000.
 */
const NEAR_LIMIT = MAX_REVIEW_LENGTH * 0.9;

/** The restaurant a review is about, as the form's header shows it. */
export interface ReviewFormRestaurant {
    id: number;
    name: string;
    city?: string | null;
    state?: string | null;
    /** Its cover photo's url, if it has one. */
    cover?: string | null;
}

interface ReviewFormProps {
    /** The page's heading: "Write a review for Uchi". */
    title: string;
    restaurant: ReviewFormRestaurant;
    review: string;
    onReviewChange: (review: string) => void;
    rating: number | null;
    onRatingChange: (rating: number) => void;
    errors: string[];
    onErrors: (errors: string[]) => void;
    /** Sends it, once it has a rating and some words: the review trimmed. */
    onSubmit: (review: string, rating: number) => void;
    submitLabel: string;
    busy: boolean;
    /** What the button says while it's busy. */
    busyLabel: string;
    /** Held back for another reason: a photo being removed, on the edit page. */
    submitDisabled?: boolean;
    /** The photo picker. */
    children?: React.ReactNode;
}

/** Why the review can't be sent as it stands; none when it can. */
export function reviewProblems(review: string, rating: number | null): string[] {
    const problems: string[] = [];
    if (rating === null) problems.push("Choose a rating, from one to five stars.");
    const trimmed = review.trim();
    if (!trimmed) problems.push("Write your review.");
    else if (trimmed.length > MAX_REVIEW_LENGTH) problems.push(`Reviews must be ${count(MAX_REVIEW_LENGTH)} characters or fewer.`);
    return problems;
}

/**
 * Writing a review and editing one, on one form (#132): the restaurant it is
 * about, stars to rate it, room to write, its photos, and a way back.
 *
 * The two pages were the scaffold's: a one-line box that scrolled the review
 * out of sight as it grew (on the edit page, cut off mid-sentence), a select
 * of 1 to 5 that started at 3, "review:" and "rating:" for labels, nothing to
 * say which restaurant it was, and no Cancel. Each page keeps what differs --
 * loading, who may see the form, and what sending does -- and hands this the
 * fields.
 *
 * The browser's own required-field bubbles are off (noValidate): the form
 * says what is missing in its own list, and sends focus to the first of it.
 */
function ReviewForm({
    title, restaurant, review, onReviewChange, rating, onRatingChange, errors, onErrors, onSubmit,
    submitLabel, busy, busyLabel, submitDisabled = false, children,
}: ReviewFormProps): React.JSX.Element {
    const id = useId();
    const firstStarRef = useRef<HTMLInputElement>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const place = [restaurant.city, restaurant.state].filter(Boolean).join(", ");

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const problems = reviewProblems(review, rating);
        if (problems.length > 0 || rating === null) {
            onErrors(problems);
            (rating === null ? firstStarRef.current : textRef.current)?.focus();
            return;
        }
        onErrors([]);
        onSubmit(review.trim(), rating);
    };

    return (
        <div className="review-form-page">
            <div className="review-form-restaurant">
                <img
                    className="review-form-cover"
                    src={restaurant.cover || DEFAULT_RESTAURANT_IMAGE}
                    alt=""
                    onError={onRestaurantImageError}
                />
                <div className="review-form-heading">
                    <h1 className="review-form-title">{title}</h1>
                    {place && <p className="review-form-place">{place}</p>}
                </div>
            </div>

            <form className="review-form" onSubmit={handleSubmit} noValidate>
                <div className="review-form-body">
                    <FormErrors errors={errors} className="review-form-errors" itemClassName="review-form-error" />

                    <StarPicker value={rating} onChange={onRatingChange} firstStarRef={firstStarRef} />

                    {/* Not wrapped in its label: the counter would sit inside
                        it and become part of the field's name. */}
                    <div className="review-form-field">
                        <label className="review-form-label" htmlFor={`${id}-review`}>Your review</label>
                        <textarea
                            ref={textRef}
                            id={`${id}-review`}
                            value={review}
                            onChange={(e) => onReviewChange(e.target.value)}
                            rows={6}
                            maxLength={MAX_REVIEW_LENGTH}
                            required
                            placeholder="What did you have? How was the service? Would you go back?"
                            aria-describedby={`${id}-count`}
                        />
                        <span
                            id={`${id}-count`}
                            className={`review-form-count${review.length > NEAR_LIMIT ? " near-limit" : ""}`}
                        >
                            {count(review.length)}/{count(MAX_REVIEW_LENGTH)}
                        </span>
                    </div>

                    {children}
                </div>

                <div className="review-form-footer">
                    <Link className="review-form-cancel" to={`/single/${restaurant.id}`}>
                        Cancel
                    </Link>
                    <button className="review-form-submit" type="submit" disabled={busy || submitDisabled}>
                        {busy && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>}
                        {busy ? busyLabel : submitLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ReviewForm;
