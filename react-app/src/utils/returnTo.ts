/**
 * Coming back to the page you were on after logging in or signing up (#135).
 *
 * Both pages sent everyone home: someone reading a restaurant who logged in
 * to save it had to find it again. A link to either page now carries the
 * page it was followed from, in the history entry's state, and the page goes
 * back there once you are signed in.
 */

export type AuthPage = "/login" | "/signup";

const AUTH_PAGES: string[] = ["/login", "/signup"];

/** What a link to the login or signup page carries. */
export interface ReturnState {
    /** The path it was followed from, with its query and hash: "/single/2". */
    from?: string;
}

/** The parts of a location this reads. */
interface Here {
    pathname: string;
    search: string;
    hash: string;
    state?: unknown;
}

/**
 * Where to go once signed in: the page the link was followed from, or home.
 *
 * Only a path inside the app is taken. "https://elsewhere", "//elsewhere"
 * and "/\elsewhere" -- which a browser reads as "//elsewhere" -- are not,
 * whatever put them in the state; nor is the login or signup page itself,
 * which would only send a signed-in reader straight home anyway.
 */
export function returnPath(state: unknown): string {
    const from = (state as ReturnState | null | undefined)?.from;
    if (typeof from !== "string" || !/^\/(?![/\\])/.test(from)) return "/";
    if (AUTH_PAGES.includes(from.split(/[?#]/)[0])) return "/";
    return from;
}

/**
 * A link to the login or signup page that remembers where it was followed
 * from. Followed from one of those two pages -- "Don't have an account?
 * Sign Up" -- it passes on where that one came from, not itself.
 */
export function authLink(to: AuthPage, here: Here): { pathname: AuthPage; state: ReturnState } {
    const from = AUTH_PAGES.includes(here.pathname)
        ? returnPath(here.state)
        : `${here.pathname}${here.search}${here.hash}`;
    return { pathname: to, state: { from } };
}
