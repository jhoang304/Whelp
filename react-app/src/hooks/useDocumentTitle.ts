import { useEffect } from "react";

/** The site's name: the whole title until a page names itself. */
export const SITE = "Whelp";

/** "Nancy's Hustle – Houston, TX" as the tab shows it: "Nancy's Hustle – Houston, TX · Whelp". */
export const pageTitle = (title: string): string => `${title} · ${SITE}`;

/**
 * The tab's title while the component is on the page, and the one before it
 * back when it goes (#130). Every page, tab and history entry was "Whelp":
 * with a few restaurants open, nobody could tell them apart, and a screen
 * reader announced no change of page.
 *
 * null leaves the title alone: a page that shows a PageMessage for now (a
 * restaurant that isn't there, a log-in prompt) lets the message name it.
 * Effects run child first, so a page setting its own title there would
 * overwrite the message's.
 */
export function useDocumentTitle(title: string | null): void {
    useEffect(() => {
        if (title === null) return undefined;
        const previous = document.title;
        document.title = title;
        return () => {
            document.title = previous;
        };
    }, [title]);
}
