import React, { useCallback, useEffect, useRef, useState } from "react";

import { onRestaurantImageError } from "../../utils/images";

/** How fast the strip drifts while it rotates on its own. */
export const ROTATE_PX_PER_SECOND = 40;


export interface CarouselPhoto {
    id: number;
    url: string;
    /** Its place among the restaurant's photos, for the viewer and the label. */
    index: number;
}

interface PhotoCarouselProps {
    /** In the order shown: the cover first. */
    photos: CarouselPhoto[];
    /** The restaurant's name, for each photo's label. */
    name: string;
    onOpen: (index: number) => void;
    /** Laid over the photos, bottom left: the name, rating and the rest. */
    children?: React.ReactNode;
    /** Bottom right, beside the pause button: See all photos. */
    corner?: React.ReactNode;
}

/**
 * Whether focus arrived from the keyboard. A mouse click on a button focuses
 * it too, and counting that as "focus inside" held the strip still after Play
 * until something else was clicked. Where the browser cannot say, assume the
 * keyboard: holding still by mistake is the safer error.
 */
const keyboardFocus = (element: Element): boolean => {
    try {
        return element.matches(":focus-visible");
    } catch {
        return true;
    }
};

const motionReduced = (): boolean =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Every photo in a strip, edge to edge, that drifts sideways on its own and
 * loops without end.
 *
 * The loop is a second copy of the photos after the first: once the strip
 * has drifted one copy's width it steps back by exactly that much, which
 * shows the same thing, so the join never shows. The copy is hidden from
 * screen readers and skipped by Tab, and only exists when the photos are
 * wider than the window -- with too few to fill it, nothing moves.
 *
 * It holds still while the pointer is over it or keyboard focus is inside it,
 * exactly where it is, and stops for good once someone takes over: an arrow,
 * a photo, a swipe, or the pause button. Play starts it again at once, even
 * with the pointer still over it; hovering holds it again once the pointer
 * has left and come back. Nobody who has asked their system for less motion
 * sees it move at all.
 */
function PhotoCarousel({ photos, name, onOpen, children, corner }: PhotoCarouselProps): React.JSX.Element {
    const trackRef = useRef<HTMLDivElement>(null);
    const setRef = useRef<HTMLDivElement>(null);
    const [loopable, setLoopable] = useState(false);
    const [hovering, setHovering] = useState(false);
    const [focused, setFocused] = useState(false);
    const [stopped, setStopped] = useState(false);
    // Play was pressed: move now, whatever the pointer and focus are doing.
    // Cleared when they leave, so a later hover holds it as usual.
    const [playing, setPlaying] = useState(false);
    const still = motionReduced();
    const rotating = loopable && !still && !stopped && (playing || (!hovering && !focused));

    const measure = useCallback(() => {
        const track = trackRef.current;
        const set = setRef.current;
        if (!track || !set) return;
        setLoopable(set.scrollWidth > track.clientWidth + 1);
    }, []);

    useEffect(() => {
        // Once the photos are in, again as each loads and takes its width,
        // and whenever the window changes size.
        measure();
        const track = trackRef.current;
        track?.addEventListener("load", measure, true);
        window.addEventListener("resize", measure);
        return () => {
            track?.removeEventListener("load", measure, true);
            window.removeEventListener("resize", measure);
        };
    }, [measure, photos.length]);

    /** One copy of the photos: the photos touch, so the next starts there. */
    const loopWidth = () => setRef.current?.offsetWidth ?? 0;

    useEffect(() => {
        const track = trackRef.current;
        if (!rotating || !track) return;
        // Kept here rather than read back from scrollLeft, which a browser may
        // round: a fraction of a pixel a frame, rounded down, never moves.
        let position = track.scrollLeft;
        let last: number | null = null;
        let frame = 0;
        const drift = (now: number) => {
            // A tab left in the background resumes where it was, not with a
            // lurch to wherever the time away would have taken it.
            const seconds = last === null ? 0 : Math.min(now - last, 50) / 1000;
            last = now;
            position += ROTATE_PX_PER_SECOND * seconds;
            const width = loopWidth();
            if (width > 0 && position >= width) position -= width;
            track.scrollLeft = position;
            frame = requestAnimationFrame(drift);
        };
        frame = requestAnimationFrame(drift);
        return () => cancelAnimationFrame(frame);
    }, [rotating]);

    const takeOver = () => {
        setStopped(true);
        setPlaying(false);
    };

    const step = (direction: 1 | -1) => {
        takeOver();
        const track = trackRef.current;
        if (!track) return;
        const distance = direction * track.clientWidth * 0.8;
        if (loopable) {
            // Step over the join first, instantly and invisibly, so the
            // scroll that follows always has somewhere to go.
            const width = loopWidth();
            if (direction < 0 && track.scrollLeft + distance < 0) track.scrollLeft += width;
            if (direction > 0 && track.scrollLeft + distance > width) track.scrollLeft -= width;
        }
        track.scrollBy({ left: distance, behavior: still ? "auto" : "smooth" });
    };

    const photoButtons = (copy: boolean) => photos.map((photo) => (
        <button
            key={photo.id}
            type="button"
            className="restaurant-carousel-photo"
            onClick={() => { takeOver(); onOpen(photo.index); }}
            aria-label={copy ? undefined : `Enlarge photo ${photo.index + 1} of ${photos.length} of ${name}`}
            tabIndex={copy ? -1 : undefined}
        >
            <img src={photo.url} alt="" onError={onRestaurantImageError} />
        </button>
    ));

    return (
        <section
            className={`restaurant-carousel${rotating ? " rotating" : ""}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => {
                setHovering(false);
                setPlaying(false);
            }}
            onFocus={(event) => { if (keyboardFocus(event.target)) setFocused(true); }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setFocused(false);
                    setPlaying(false);
                }
            }}
        >
            {photos.length > 0 ? (
                <div
                    className="restaurant-carousel-track"
                    ref={trackRef}
                    role="group"
                    aria-label={`Photos of ${name}`}
                    // A touch -- the start of a swipe -- or a sideways scroll on a
                    // trackpad, is taking over.
                    onTouchStart={takeOver}
                    onWheel={(event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) takeOver(); }}
                >
                    <div className="restaurant-carousel-set" ref={setRef}>{photoButtons(false)}</div>
                    {loopable && (
                        <div className="restaurant-carousel-set" aria-hidden="true">{photoButtons(true)}</div>
                    )}
                </div>
            ) : (
                <div className="restaurant-carousel-empty">
                    <i className="fa-regular fa-image" aria-hidden="true"></i>
                    <span>No photos yet</span>
                </div>
            )}

            {/* A shade over the photos, so white text on them can be read. */}
            {photos.length > 0 && <div className="restaurant-carousel-shade" aria-hidden="true"></div>}

            <div className="restaurant-carousel-overlay">
                <div className="restaurant-carousel-content">{children}</div>
                <div className="restaurant-carousel-controls">
                    {loopable && !still && (
                        <button
                            type="button"
                            className="restaurant-carousel-pause"
                            onClick={() => {
                                if (stopped) {
                                    setStopped(false);
                                    setPlaying(true);
                                } else {
                                    setStopped(true);
                                    setPlaying(false);
                                }
                            }}
                            aria-label={stopped ? "Play photos" : "Pause photos"}
                        >
                            <i className={`fa-solid ${stopped ? "fa-play" : "fa-pause"}`} aria-hidden="true"></i>
                        </button>
                    )}
                    {corner}
                </div>
            </div>

            {loopable && (
                <>
                    <button
                        type="button"
                        className="restaurant-carousel-arrow back"
                        onClick={() => step(-1)}
                        aria-label="Previous photos"
                    >
                        <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <button
                        type="button"
                        className="restaurant-carousel-arrow forward"
                        onClick={() => step(1)}
                        aria-label="Next photos"
                    >
                        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </>
            )}
        </section>
    );
}

export default PhotoCarousel;
