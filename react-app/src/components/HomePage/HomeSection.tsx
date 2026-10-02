import React, { useId } from "react";
import { Link } from "react-router-dom";
import { ListState } from "./useList";

interface HomeSectionProps<T> {
    title: string;
    /** "See all", and what it is all of, for a screen reader: "top rated restaurants". */
    seeAll?: { to: string; what: string };
    state: ListState<T>;
    retry: () => void;
    /** Grey stand-ins for the items, while they load. */
    skeleton: React.ReactNode;
    children: (items: T[]) => React.ReactNode;
}

/**
 * A titled row of the home page (#134): stand-ins while it loads, a message
 * and Try again if it can't, and nothing at all when there is nothing to
 * show -- a new site has no reviews yet, and an empty "Recent reviews" says
 * less than no heading.
 */
function HomeSection<T>({ title, seeAll, state, retry, skeleton, children }: HomeSectionProps<T>): React.JSX.Element | null {
    const id = useId();
    if (state.status === "ready" && state.items.length === 0) return null;

    return (
        <section className="home-section" aria-labelledby={id} aria-busy={state.status === "loading"}>
            <div className="home-section-header">
                <h2 id={id} className="home-section-title">{title}</h2>
                {seeAll && state.status === "ready" && (
                    <Link className="home-section-see-all" to={seeAll.to} aria-label={`See all ${seeAll.what}`}>
                        See all <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </Link>
                )}
            </div>
            {state.status === "loading" && (
                <>
                    <p className="visually-hidden">Loading {title.toLowerCase()}...</p>
                    <div aria-hidden="true">{skeleton}</div>
                </>
            )}
            {state.status === "error" && (
                <div className="home-section-error">
                    <p>{state.message}</p>
                    <button type="button" onClick={retry}>Try again</button>
                </div>
            )}
            {state.status === "ready" && children(state.items)}
        </section>
    );
}

export default HomeSection;
