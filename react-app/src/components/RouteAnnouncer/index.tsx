import React, { useEffect, useState } from "react";
import { SITE } from "../../hooks/useDocumentTitle";

/**
 * Says the new page's title to a screen reader when it changes (#130).
 *
 * A page load in a browser announces the title; a route change in an app
 * doesn't, so moving from the list to a restaurant was silence. This watches
 * the <title> and reads each new one out, politely, once it is the page's
 * own: the bare "Whelp" a page shows while it loads is skipped, so the
 * restaurant is announced by name rather than "Whelp" first. The title the
 * page opened with isn't announced -- the browser said it already.
 */
function RouteAnnouncer(): React.JSX.Element {
    const [message, setMessage] = useState("");

    useEffect(() => {
        const title = document.querySelector("title");
        if (!title || typeof MutationObserver === "undefined") return undefined;
        let last = document.title;
        const observer = new MutationObserver(() => {
            const now = document.title;
            if (now === last || now === SITE) return;
            last = now;
            setMessage(now);
        });
        observer.observe(title, { childList: true, characterData: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="visually-hidden" aria-live="polite" aria-atomic="true">
            {message}
        </div>
    );
}

export default RouteAnnouncer;
