import "./SingleRestaurant.css"
import React, { useCallback, useEffect, useRef } from "react";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Link, useParams } from 'react-router-dom';
import { getSingleRestaurant, deleteRestaurantThunk, getAllRestaurants } from "../../store/restaurants"
import AddPhotoModal from "../AddPhotoModal";
import OpenModalButton from "../OpenModalButton";
import EditRestaurant from "../EditRestaurantModal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import GetAllReviews from "../Reviews/GetAllReviews";
import RatingStar from "../RatingStar";
import CategoryChips from "../CategoryChips";
import OpenStatus from "../OpenStatus";
import OpeningHoursTable from "../OpeningHoursTable";
import DisplayPhotos from "../DisplayPhotos";
import FavoriteButton from "../FavoriteButton";
import Lightbox from "../Lightbox";
import { onRestaurantImageError } from "../../utils/images";
import { useAppDispatch, useAppSelector } from "../../store";


/** Font Awesome icons for each amenity the app knows; a tick for any other. */
const AMENITY_ICONS: { [slug: string]: string } = {
    "reservations": "fa-calendar-check",
    "delivery": "fa-truck",
    "takeout": "fa-bag-shopping",
    "outdoor-seating": "fa-umbrella-beach",
    "credit-cards": "fa-credit-card",
    "wheelchair-accessible": "fa-wheelchair",
    "wifi": "fa-wifi",
    "groups": "fa-user-group",
};

function getMap(str: string): string {
    return str.replace(/\s+/g, "+")
}

interface SingleRestaurantParams {
    restaurantId: string;
}

type Status = "loading" | "ready" | "error";

/**
 * A restaurant's page: its photos, what it is, and everything else about it.
 *
 * A carousel of every photo across the top, edge to edge; the name and what
 * it is on white beneath, with the actions beside the name; and then the
 * details and reviews with the contact card alongside.
 */
function SingleRestaurant(): React.JSX.Element {
    const history = useHistory();
    const { restaurantId } = useParams<SingleRestaurantParams>()

    const singleRestaurant = useAppSelector((state) => {
        return state.Restaurants.singleRestaurant
    })

    const dispatch = useAppDispatch()
    const [status, setStatus] = useState<Status>("loading");
    const [loadErrors, setLoadErrors] = useState<string[]>([]);
    // Which photo is enlarged from the carousel, as an index into restaurantImages.
    const [openPhoto, setOpenPhoto] = useState<number | null>(null);

    // The carousel, and whether it can scroll further either way: an arrow
    // with nowhere to go is hidden rather than left there doing nothing.
    const trackRef = useRef<HTMLDivElement>(null);
    const [canScroll, setCanScroll] = useState({ back: false, forward: false });
    const measureScroll = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        setCanScroll({
            back: track.scrollLeft > 1,
            forward: track.scrollLeft + track.clientWidth < track.scrollWidth - 1,
        });
    }, []);

    useEffect(() => {
        if (!restaurantId) return;
        let cancelled = false;
        setStatus("loading");
        setOpenPhoto(null);
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
    }, [dispatch, restaurantId])

    const sessionUser = useAppSelector((state) => state.session.user);

    const photoCount = singleRestaurant?.restaurantImages?.length ?? 0;
    useEffect(() => {
        // Again once the photos arrive, as each one loads and takes its width,
        // and whenever the window changes size.
        measureScroll();
        const track = trackRef.current;
        if (!track) return;
        track.addEventListener("load", measureScroll, true);
        window.addEventListener("resize", measureScroll);
        return () => {
            track.removeEventListener("load", measureScroll, true);
            window.removeEventListener("resize", measureScroll);
        };
    }, [measureScroll, status, photoCount]);

    const scrollPhotos = (direction: 1 | -1) => {
        const track = trackRef.current;
        if (!track) return;
        const still = typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Most of a screen at a time, leaving a sliver of what was just seen.
        track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
    };

    const handleDelete = () => {
        if (restaurantId) {
            dispatch(deleteRestaurantThunk(+restaurantId))
                .then(() => dispatch(getAllRestaurants()))
                .then(() => history.push("/"));
        }
    };

    if (status === "error" || (status === "ready" && !singleRestaurant)) {
        return (
            <div className="restaurant-not-found">
                <i className="fa-regular fa-face-frown"></i>
                <h2>{loadErrors[0] || "We couldn't find that restaurant."}</h2>
                <Link to="/restaurants" className="restaurant-not-found-button">Browse restaurants</Link>
            </div>
        );
    }

    if (status === "loading" || !singleRestaurant) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">
                    <span className="loading-word">Loading</span>
                    <span className="loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                    </span>
                </div>
            </div>
        );
    }

    const isOwner = !!sessionUser && sessionUser.id === singleRestaurant.user_id;
    const images = singleRestaurant.restaurantImages || [];
    const photos = images.map((image, index) => ({
        url: image.url,
        alt: `${singleRestaurant.name}, ${index + 1} of ${images.length}`,
    }));
    // The cover leads the carousel, wherever it sits in the list: it is the
    // photo the owner chose to be seen first.
    const cover = images.findIndex((image) => image.preview);
    const order = images.map((_, index) => index);
    if (cover > 0) order.unshift(...order.splice(cover, 1));

    const address = [singleRestaurant.address, singleRestaurant.city, singleRestaurant.state,
        singleRestaurant.zipcode, singleRestaurant.country].filter(Boolean).join(", ");
    const website = singleRestaurant.website.startsWith("http")
        ? singleRestaurant.website
        : `http://${singleRestaurant.website}`;
    // "nancyshustle.com", not "http://nancyshustle.com/".
    const websiteLabel = singleRestaurant.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const average = Number(singleRestaurant.avgStarRating) || 0;

    return (
        <div className="restaurant-page-wrap">
            {/* Edge to edge, outside the page's centred column: a strip of
                every photo, cover first, that scrolls sideways. */}
            <section className="restaurant-carousel" aria-label="Photos">
                {images.length > 0 ? (
                    <div className="restaurant-carousel-track" ref={trackRef} onScroll={measureScroll}>
                        {order.map((imageIndex) => (
                            <button
                                key={images[imageIndex].id}
                                type="button"
                                className="restaurant-carousel-photo"
                                onClick={() => setOpenPhoto(imageIndex)}
                                aria-label={`Enlarge photo ${imageIndex + 1} of ${images.length} of ${singleRestaurant.name}`}
                            >
                                <img src={images[imageIndex].url} alt="" onError={onRestaurantImageError} />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="restaurant-carousel-empty">
                        <i className="fa-regular fa-image" aria-hidden="true"></i>
                        <span>No photos yet</span>
                    </div>
                )}
                {images.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="restaurant-carousel-arrow back"
                            onClick={() => scrollPhotos(-1)}
                            disabled={!canScroll.back}
                            aria-label="Previous photos"
                        >
                            <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        </button>
                        <button
                            type="button"
                            className="restaurant-carousel-arrow forward"
                            onClick={() => scrollPhotos(1)}
                            disabled={!canScroll.forward}
                            aria-label="Next photos"
                        >
                            <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        </button>
                    </>
                )}
                {images.length > 0 && (
                    <OpenModalButton
                        className="restaurant-carousel-all"
                        buttonText={<><i className="fa-solid fa-table-cells-large" aria-hidden="true"></i> See all {images.length} photos</>}
                        modalComponent={<DisplayPhotos singleRestaurant={singleRestaurant} />}
                    />
                )}
            </section>

            <div className="restaurant-page">

            {openPhoto !== null && (
                <Lightbox
                    photos={photos}
                    index={openPhoto}
                    onIndexChange={setOpenPhoto}
                    onClose={() => setOpenPhoto(null)}
                />
            )}

            <header className="restaurant-header">
                <div className="restaurant-heading">
                    <h1 className="restaurant-name">{singleRestaurant.name}</h1>
                    <div className="restaurant-rating">
                        <RatingStar size="24" rating={average} />
                        <span className="restaurant-rating-number">{average.toFixed(1)}</span>
                        <a className="restaurant-rating-count" href="#reviews">
                            {singleRestaurant.numReviews} {singleRestaurant.numReviews === 1 ? "review" : "reviews"}
                        </a>
                    </div>
                    <div className="restaurant-meta">
                        <span className="restaurant-price">{singleRestaurant.price}</span>
                        <span aria-hidden="true">·</span>
                        <span>{singleRestaurant.city}, {singleRestaurant.state}</span>
                    </div>
                    <CategoryChips categories={singleRestaurant.categories} className="single-restaurant-chips" />
                    <OpenStatus status={singleRestaurant.openStatus} className="restaurant-header-status" />
                </div>

                {sessionUser && (
                    <div className="restaurant-actions">
                        <FavoriteButton
                            variant="labelled"
                            restaurantId={singleRestaurant.id}
                            name={singleRestaurant.name}
                            isFavorited={!!singleRestaurant.isFavorited}
                        />
                        <OpenModalButton
                            className="restaurant-action"
                            buttonText={<><i className="fa-solid fa-camera" aria-hidden="true"></i> Add photo</>}
                            modalComponent={<AddPhotoModal restaurantId={restaurantId} />}
                        />
                        {isOwner && (
                            <>
                                <OpenModalButton
                                    className="restaurant-action"
                                    ariaLabel="Edit restaurant"
                                    buttonText={<><i className="fa-solid fa-pen" aria-hidden="true"></i> Edit</>}
                                    modalComponent={<EditRestaurant singleRestaurant={singleRestaurant} />}
                                />
                                <OpenModalButton
                                    className="restaurant-action danger"
                                    ariaLabel="Delete restaurant"
                                    buttonText={<><i className="fa-solid fa-trash" aria-hidden="true"></i> Delete</>}
                                    modalComponent={
                                        <ConfirmDeleteModal
                                            title="Delete Restaurant"
                                            message={<>Are you sure you want to delete <strong>"{singleRestaurant.name}"</strong>?</>}
                                            detail="This action cannot be undone. All reviews and photos associated with this restaurant will also be permanently deleted."
                                            confirmLabel="Delete Restaurant"
                                            onConfirm={handleDelete}
                                        />
                                    }
                                />
                            </>
                        )}
                    </div>
                )}
            </header>

            {/* Three areas, placed by CSS: the details and the reviews in one
                column with the contact card beside them, sticking as you
                scroll, on a wide screen; on a phone, one column with the card
                between the two -- under the description, ahead of the reviews. */}
            <div className="restaurant-layout">
                <div className="restaurant-details">
                    {singleRestaurant.amenities?.length > 0 && (
                        <section className="restaurant-section" aria-labelledby="amenities-heading">
                            <h2 id="amenities-heading">Amenities and more</h2>
                            <ul className="restaurant-amenities">
                                {singleRestaurant.amenities.map((amenity) => (
                                    <li key={amenity.id}>
                                        <span className="restaurant-amenity-icon" aria-hidden="true">
                                            <i className={`fa-solid ${AMENITY_ICONS[amenity.slug] || "fa-check"}`}></i>
                                        </span>
                                        {amenity.name}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {singleRestaurant.hours?.length > 0 && (
                        <section className="restaurant-section restaurant-hours">
                            <OpeningHoursTable
                                hours={singleRestaurant.hours}
                                timezone={singleRestaurant.timezone}
                            />
                        </section>
                    )}

                    <section className="restaurant-section" aria-labelledby="about-heading">
                        <h2 id="about-heading">About the business</h2>
                        <p className="restaurant-description">{singleRestaurant.description}</p>
                    </section>
                </div>

                <aside className="restaurant-sidebar" aria-label="Contact">
                    <div className="restaurant-contact">
                        <a className="restaurant-contact-row" href={website} target="_blank" rel="noreferrer">
                            <span className="restaurant-contact-text">
                                <span className="restaurant-contact-label">Website</span>
                                <span className="restaurant-contact-value">{websiteLabel}</span>
                            </span>
                            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                        </a>
                        <a className="restaurant-contact-row" href={`tel:${singleRestaurant.phone_number.replace(/[^\d+]/g, "")}`}>
                            <span className="restaurant-contact-text">
                                <span className="restaurant-contact-label">Phone</span>
                                <span className="restaurant-contact-value">{singleRestaurant.phone_number}</span>
                            </span>
                            <i className="fa-solid fa-phone" aria-hidden="true"></i>
                        </a>
                        <a
                            className="restaurant-contact-row"
                            href={getMap("https://www.google.com/maps/place/" + address)}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <span className="restaurant-contact-text">
                                <span className="restaurant-contact-label">Get directions</span>
                                <span className="restaurant-contact-value">{address}</span>
                            </span>
                            <i className="fa-solid fa-diamond-turn-right" aria-hidden="true"></i>
                        </a>
                    </div>
                </aside>

                <section id="reviews" className="restaurant-section restaurant-reviews">
                    <GetAllReviews restaurantId={restaurantId} />
                </section>
            </div>
            </div>
        </div>
    )
}



export default SingleRestaurant
