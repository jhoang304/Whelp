/**
 * Signing in with Google, from the pages' side.
 *
 * The server does the work (app/api/google_routes.py). The pages send the
 * browser to it -- a real visit, not a fetch, since it goes on to Google and
 * back -- and when it comes back with ?google=<what happened>, say what
 * happened.
 */
import { apiFetch } from "./api";

export interface GoogleStatus {
    /** The server can sign people in with Google: it has a client set up. */
    available: boolean;
    /**
     * Whoever is signed in did so with Google in the last ten minutes, which
     * an account with no password needs to set one or to delete itself.
     */
    confirmed: boolean;
}

const NOT_OFFERED: GoogleStatus = { available: false, confirmed: false };

/** What GET /api/auth/google says. Unreachable or unreadable is "not offered". */
export async function fetchGoogleStatus(): Promise<GoogleStatus> {
    try {
        const response = await apiFetch("/api/auth/google");
        if (!response.ok) return NOT_OFFERED;
        const body = await response.json();
        return { available: body?.available === true, confirmed: body?.confirmed === true };
    } catch {
        return NOT_OFFERED;
    }
}

/** Off to Google to sign in, then back to `next`. */
export const googleSignInUrl = (next: string) => `/api/auth/google/start?${new URLSearchParams({ next })}`;

/** Off to Google to confirm it's you, then back to Account settings. */
export const GOOGLE_CONFIRM_URL = "/api/auth/google/start?intent=confirm";

/** What the server's ?google= codes mean, said for the page they land on. */
const PROBLEMS: Record<string, string> = {
    cancelled: "Google sign-in was cancelled.",
    expired: "That Google sign-in expired, or was started in another tab. Please try again.",
    failed: "Couldn't sign in with Google. Please try again.",
    unavailable: "Signing in with Google isn't available right now.",
    unverified: "Google hasn't verified that account's email address, so it can't be used to sign up.",
    "account-exists": "An account already uses that Google account's email address. Log in with your "
        + "password, then connect Google in Account settings.",
    "in-use": "That Google account is already connected to another Whelp account.",
    "already-connected": "A Google account is already connected.",
    "wrong-account": "That isn't the Google account connected to Whelp. Try again, and choose that one.",
    demo: "The demo account can't connect a Google account: everyone shares it.",
};

const SUCCESSES: Record<string, string> = {
    connected: "Google is connected. You can log in with it from now on.",
    confirmed: "Thanks, that's confirmed for the next 10 minutes.",
};

export interface GoogleOutcome {
    problem: string | null;
    success: string | null;
}

const has = (messages: Record<string, string>, code: string) =>
    Object.prototype.hasOwnProperty.call(messages, code);

/** What a page's ?google= says happened, if anything. A code it doesn't know is a failure. */
export function googleOutcome(search: string): GoogleOutcome {
    const code = new URLSearchParams(search).get("google");
    if (code === null) return { problem: null, success: null };
    if (has(SUCCESSES, code)) return { problem: null, success: SUCCESSES[code] };
    return { problem: has(PROBLEMS, code) ? PROBLEMS[code] : PROBLEMS.failed, success: null };
}

/** Send the browser somewhere: Google's page. Its own function so a test can stand in for it. */
export function navigateTo(url: string): void {
    window.location.assign(url);
}
