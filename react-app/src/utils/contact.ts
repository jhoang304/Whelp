import { PHONE_EXTENSION, stripExtension } from "./phone";

/**
 * The contact card's three links, built so ordinary input doesn't break them
 * (#123).
 */

/**
 * `tel:` with the extension kept apart: "(832) 344-8051 x12" dials
 * 8323448051, then 12. With every digit run together it was a different,
 * longer number.
 */
export function telHref(phone: string): string {
    const extension = PHONE_EXTENSION.exec(phone)?.[0].replace(/\D/g, "");
    const number = stripExtension(phone).replace(/[^\d+]/g, "");
    return `tel:${number}${extension ? `;ext=${extension}` : ""}`;
}

/**
 * Directions to the address, as Google documents its search links. The
 * address is encoded: "2704 Polk St #100" had its "#" start a fragment, and
 * Maps was never given the city, state or zip after it; "&" and "?" broke it
 * the same way.
 */
export function directionsHref(address: string): string {
    return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: address })}`;
}

const SCHEME = /^https?:\/\//i;

/**
 * The website as a link that leaves the app. "HTTPS://..." has a scheme, and
 * "httpster.com" doesn't: startsWith("http") had them the other way round,
 * and the second became a link inside the app, /single/httpster.com.
 */
export function websiteHref(website: string): string {
    return SCHEME.test(website) ? website : `http://${website}`;
}

/** "nancyshustle.com", not "http://nancyshustle.com/". */
export function websiteLabel(website: string): string {
    return website.replace(SCHEME, "").replace(/\/$/, "");
}
