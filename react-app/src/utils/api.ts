/**
 * `fetch` for Whelp's own API: a request that changes something (POST, PUT,
 * PATCH, DELETE) carries the CSRF token in an X-CSRFToken header.
 *
 * The server refuses a change without it (#109). The token is the
 * `csrf_token` cookie, which every response sets. A page on another site can
 * make the browser send that cookie with a forged request, but cannot read it
 * to fill in the header -- which is the whole check.
 */

const READS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/**
 * What a thunk says when fetch itself rejects: the browser is offline or the
 * connection dropped, and there is no response to read a message off.
 */
export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

/** The token the server set last, or null before any response has come back. */
export function csrfToken(): string | null {
    const pair = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("csrf_token="));
    return pair ? decodeURIComponent(pair.slice("csrf_token=".length)) : null;
}

/**
 * Only ever sent to this origin: a path like "/api/…", never a full URL,
 * so the token cannot leak to another host.
 */
const ownOrigin = (url: string) => url.startsWith("/") && !url.startsWith("//");

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const token = READS.has(method) || !ownOrigin(url) ? null : csrfToken();
    // Nothing to add: the request goes out exactly as written.
    if (!token) return init === undefined ? fetch(url) : fetch(url, init);
    return fetch(url, {
        ...init,
        headers: { ...(init?.headers as Record<string, string> | undefined), "X-CSRFToken": token },
    });
}
