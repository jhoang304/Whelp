import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useHistory, useParams } from "react-router-dom";
import { AppDispatch } from "../../store";
import { Restaurant, Review, RootState } from "../../types";
import { getProfileThunk } from "../../store/userProfile";
import { deleteReviewById } from "../../store/reviews";
import OpenModalButton from "../OpenModalButton";
import CreateRestaurantModal from "../CreateRestaurantModal";
import RatingStar from "../RatingStar";
import OwnerResponse from "../Reviews/OwnerResponse";
import UpdateProfile from "./UpdateProfile";
import {
    avatarUrl,
    onAvatarError,
    DEFAULT_RESTAURANT_IMAGE,
    onRestaurantImageError,
} from "../../utils/images";
import "./UserProfilePage.css";

type Tab = "reviews" | "businesses";
type Status = "loading" | "ready" | "error";

const LONG_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" };

const formatDate = (value: string | undefined | null, options: Intl.DateTimeFormatOptions): string =>
    value ? new Date(value).toLocaleDateString("en-US", options) : "";

const plural = (count: number, singular: string, pluralForm?: string): string =>
    `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;

export default function UserProfilePage(): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    const history = useHistory();
    const { userId } = useParams<{ userId: string }>();

    const sessionUser = useSelector((state: RootState) => state.session.user);
    const { profile, reviews } = useSelector((state: RootState) => state.user);

    const [status, setStatus] = useState<Status>("loading");
    const [loadErrors, setLoadErrors] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>("reviews");

    useEffect(() => {
        let cancelled = false;
        setStatus("loading");
        setActiveTab("reviews");
        dispatch(getProfileThunk(userId) as any).then((errors: string[] | null) => {
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
    }, [dispatch, userId]);

    const isOwnProfile = !!sessionUser && !!profile && sessionUser.id === profile.id;

    const handleDeleteReview = async (review: Review) => {
        if (!window.confirm("Delete your review? This cannot be undone.")) return;
        await dispatch(deleteReviewById(review.id) as any);
        dispatch(getProfileThunk(userId) as any);
    };

    if (status === "loading") {
        return (
            <div className="profile-page">
                <div className="profile-loading">
                    <div className="profile-spinner"></div>
                    <span>Loading profile...</span>
                </div>
            </div>
        );
    }

    if (status === "error" || !profile) {
        return (
            <div className="profile-page">
                <div className="profile-empty profile-not-found">
                    <i className="fa-regular fa-face-frown"></i>
                    <h2>{loadErrors[0] || "We couldn't find that user."}</h2>
                    <Link to="/restaurants" className="profile-link-button">Browse restaurants</Link>
                </div>
            </div>
        );
    }

    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    const businesses: Restaurant[] = profile.restaurants || [];

    return (
        <div className="profile-page">
            <header className="profile-header">
                <div className="profile-header-inner">
                    <img
                        className="profile-avatar"
                        src={avatarUrl(profile)}
                        alt={`${profile.username}'s avatar`}
                        onError={onAvatarError}
                    />
                    <div className="profile-identity">
                        <h1 className="profile-name">{fullName || profile.username}</h1>
                        <div className="profile-username">@{profile.username}</div>
                        {isOwnProfile && profile.email && (
                            <div className="profile-email">
                                <i className="fa-regular fa-envelope"></i> {profile.email}
                            </div>
                        )}
                        <div className="profile-meta">
                            <span><i className="fa-solid fa-star"></i> {plural(profile.review_count, "review")}</span>
                            <span><i className="fa-solid fa-store"></i> {plural(profile.restaurant_count, "business", "businesses")}</span>
                            {profile.createdAt && (
                                <span><i className="fa-regular fa-calendar"></i> Member since {formatDate(profile.createdAt, MONTH_YEAR)}</span>
                            )}
                        </div>
                    </div>
                    {isOwnProfile && (
                        <div className="profile-actions">
                            <OpenModalButton
                                className="profile-edit-button"
                                buttonText={<><i className="fa-solid fa-pen"></i> Edit profile</>}
                                modalComponent={<UpdateProfile user={profile} />}
                            />
                        </div>
                    )}
                </div>
            </header>

            <nav className="profile-tabs" aria-label="Profile sections">
                <button
                    type="button"
                    className={activeTab === "reviews" ? "active" : ""}
                    onClick={() => setActiveTab("reviews")}
                >
                    Reviews <span className="profile-tab-count">{reviews.length}</span>
                </button>
                <button
                    type="button"
                    className={activeTab === "businesses" ? "active" : ""}
                    onClick={() => setActiveTab("businesses")}
                >
                    Businesses <span className="profile-tab-count">{businesses.length}</span>
                </button>
            </nav>

            <section className="profile-content">
                {activeTab === "reviews" && (
                    reviews.length === 0 ? (
                        <div className="profile-empty">
                            <i className="fa-regular fa-comment-dots"></i>
                            <h2>{isOwnProfile ? "You haven't written any reviews yet" : `${profile.username} hasn't written any reviews yet`}</h2>
                            {isOwnProfile && <p>Find a restaurant you love (or don't) and tell everyone about it.</p>}
                            <Link to="/restaurants" className="profile-link-button">Browse restaurants</Link>
                        </div>
                    ) : (
                        <div className="profile-review-list">
                            {reviews.map((review) => (
                                <article className="profile-review" key={review.id}>
                                    <Link to={`/single/${review.restaurant_id}`} className="profile-review-restaurant">
                                        <img
                                            className="profile-review-thumb"
                                            src={(review.restaurant && review.restaurant.previewImage) || DEFAULT_RESTAURANT_IMAGE}
                                            alt=""
                                            onError={onRestaurantImageError}
                                        />
                                        <div>
                                            <div className="profile-review-restaurant-name">
                                                {review.restaurant ? review.restaurant.name : "Restaurant"}
                                            </div>
                                            {review.restaurant && (
                                                <div className="profile-review-restaurant-location">
                                                    {review.restaurant.city}, {review.restaurant.state}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="profile-review-rating">
                                        <RatingStar size="18" rating={review.rating} />
                                        <span className="profile-review-date">{formatDate(review.createdAt, LONG_DATE)}</span>
                                    </div>
                                    <p className="profile-review-text">{review.review}</p>
                                    <OwnerResponse
                                        review={review}
                                        canManage={false}
                                        businessName={review.restaurant ? review.restaurant.name : undefined}
                                    />
                                    {isOwnProfile && (
                                        <div className="profile-review-actions">
                                            <button
                                                type="button"
                                                onClick={() => history.push(`/${review.restaurant_id}/reviews/${review.id}/update`)}
                                            >
                                                <i className="fa-solid fa-pen"></i> Edit
                                            </button>
                                            <button type="button" className="danger" onClick={() => handleDeleteReview(review)}>
                                                <i className="fa-solid fa-trash"></i> Delete
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )
                )}

                {activeTab === "businesses" && (
                    businesses.length === 0 ? (
                        <div className="profile-empty">
                            <i className="fa-solid fa-store"></i>
                            <h2>{isOwnProfile ? "You haven't added a business yet" : `${profile.username} doesn't own any businesses`}</h2>
                            {isOwnProfile && (
                                <>
                                    <p>Own a restaurant? Add it to Whelp so customers can find and review it.</p>
                                    <OpenModalButton
                                        className="profile-link-button"
                                        buttonText={<><i className="fa-solid fa-plus"></i> Add your business</>}
                                        modalComponent={<CreateRestaurantModal />}
                                    />
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="profile-business-grid">
                            {businesses.map((restaurant) => (
                                <Link to={`/single/${restaurant.id}`} className="profile-business-card" key={restaurant.id}>
                                    <img
                                        src={restaurant.previewImage || DEFAULT_RESTAURANT_IMAGE}
                                        alt=""
                                        onError={onRestaurantImageError}
                                    />
                                    <div className="profile-business-body">
                                        <div className="profile-business-name">{restaurant.name}</div>
                                        <div className="profile-business-rating">
                                            <RatingStar size="16" rating={restaurant.avgRating} />
                                            <span>{plural(restaurant.numReviews || 0, "review")}</span>
                                        </div>
                                        <div className="profile-business-meta">
                                            {restaurant.price} · {restaurant.city}, {restaurant.state}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                )}
            </section>
        </div>
    );
}
