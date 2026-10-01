import React from "react";
import PageMessage from "../PageMessage";

/**
 * Any address the app has no page for (#124): a typo, an old bookmark, a
 * link to `/restaurant/1` rather than `/single/1`. It used to draw nothing
 * between the nav and the footer -- no message, and no way on -- so it says
 * what happened in the same words and look as a restaurant that isn't there,
 * with the list and the home page to go to.
 */
function NotFound(): React.JSX.Element {
    return (
        <PageMessage
            icon="fa-regular fa-compass"
            title="We couldn't find that page."
            documentTitle="Page not found"
            action={{ to: "/restaurants", label: "Browse restaurants" }}
            secondaryAction={{ to: "/", label: "Go to the home page" }}
        >
            The link may be old, or the address mistyped.
        </PageMessage>
    );
}

export default NotFound;
