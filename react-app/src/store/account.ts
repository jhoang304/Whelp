import { AppDispatch } from "./index";
import { parseErrors } from "../utils/parseErrors";
import { removeUser } from "./session";

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
    fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

/** Change your password. Null once changed, or the messages to show. */
export const changePassword = (userId: number, currentPassword: string, newPassword: string) =>
    async (): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson(`/api/users/${userId}/password`, "PUT", {
                current_password: currentPassword,
                new_password: newPassword,
            });
        } catch {
            return [UNREACHABLE];
        }
        return response.ok ? null : parseErrors(response, "Couldn't change your password. Please try again.");
    };

export type SummaryResult =
    | { summary: DeletionSummary; errors?: undefined }
    | { summary?: undefined; errors: string[] };

export const fetchDeletionSummary = (userId: number) =>
    async (): Promise<SummaryResult> => {
        let response: Response;
        try {
            response = await fetch(`/api/users/${userId}/deletion`);
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
 */
export const deleteAccount = (userId: number, password: string) =>
    async (dispatch: AppDispatch): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson(`/api/users/${userId}`, "DELETE", { password });
        } catch {
            return [UNREACHABLE];
        }
        if (!response.ok) {
            return parseErrors(response, "Couldn't delete your account. Please try again.");
        }
        dispatch(removeUser());
        return null;
    };
