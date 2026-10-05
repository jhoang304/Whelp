import { AppDispatch } from "./index";
import { parseErrors } from "../utils/parseErrors";
import { removeUser, setUser } from "./session";
import { apiFetch } from "../utils/api";

const UNREACHABLE = "Couldn't reach the server. Please try again.";

/** What deleting the account would do, as GET /api/users/<id>/deletion says. */
export interface DeletionSummary {
    restaurants: { id: number; name: string; reviews: number }[];
    /** Your reviews, which stay as by "Deleted user". */
    reviewsKept: number;
    photos: number;
    favorites: number;
    /** The shared demo account, which can neither change password nor go. */
    isDemo: boolean;
}

const sendJson = (url: string, method: string, body: object) =>
    apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

/**
 * Change your password. Null once changed, or the messages to show. With no
 * current password -- an account made with Google -- it sets the first one.
 */
export const changePassword = (userId: number, currentPassword: string | null, newPassword: string) =>
    async (): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson(`/api/users/${userId}/password`, "PUT", currentPassword === null
                ? { new_password: newPassword }
                : { current_password: currentPassword, new_password: newPassword });
        } catch {
            return [UNREACHABLE];
        }
        return response.ok ? null : parseErrors(response, "Couldn't change your password. Please try again.");
    };

export type ConnectResult =
    | { url: string; errors?: undefined }
    | { url?: undefined; errors: string[] };

/** Start connecting a Google account: Google's page to go to, or the messages to show. */
export const connectGoogle = (password: string) =>
    async (): Promise<ConnectResult> => {
        let response: Response;
        try {
            response = await sendJson("/api/auth/google/connect", "POST", { password });
        } catch {
            return { errors: [UNREACHABLE] };
        }
        if (!response.ok) {
            return { errors: await parseErrors(response, "Couldn't connect Google. Please try again.") };
        }
        return { url: (await response.json()).url };
    };

/** Disconnect Google. Null once done -- the session's user updated -- or the messages. */
export const disconnectGoogle = () =>
    async (dispatch: AppDispatch): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await apiFetch("/api/auth/google", { method: "DELETE" });
        } catch {
            return [UNREACHABLE];
        }
        if (!response.ok) {
            return parseErrors(response, "Couldn't disconnect Google. Please try again.");
        }
        dispatch(setUser(await response.json()));
        return null;
    };

export type SummaryResult =
    | { summary: DeletionSummary; errors?: undefined }
    | { summary?: undefined; errors: string[] };

export const fetchDeletionSummary = (userId: number) =>
    async (): Promise<SummaryResult> => {
        let response: Response;
        try {
            response = await apiFetch(`/api/users/${userId}/deletion`);
        } catch {
            return { errors: [UNREACHABLE] };
        }
        if (!response.ok) {
            return { errors: await parseErrors(response, "Couldn't load what deleting your account would remove.") };
        }
        return { summary: await response.json() };
    };

/**
 * Delete your account. On success the session is cleared here -- the API has
 * already logged you out -- and null is returned; otherwise the messages.
 * An account with no password sends none: a fresh Google sign-in stands in.
 */
export const deleteAccount = (userId: number, password: string | null) =>
    async (dispatch: AppDispatch): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson(`/api/users/${userId}`, "DELETE", password === null ? {} : { password });
        } catch {
            return [UNREACHABLE];
        }
        if (!response.ok) {
            return parseErrors(response, "Couldn't delete your account. Please try again.");
        }
        dispatch(removeUser());
        return null;
    };
