/**
 * Resetting a forgotten password (app/api/password_reset_routes.py): asking
 * for a link by email, checking the link, and choosing the new password.
 */
import { AppDispatch } from "./index";
import { setUser } from "./session";
import { apiFetch, NETWORK_ERROR } from "../utils/api";
import { parseErrors } from "../utils/parseErrors";

const sendJson = (method: string, url: string, body: object) =>
    apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Whether a reset can be asked for here. Unreachable or unreadable is "no". */
export async function fetchResetAvailable(): Promise<boolean> {
    try {
        const response = await apiFetch("/api/auth/password-reset");
        if (!response.ok) return false;
        const body = await response.json();
        return body?.available === true;
    } catch {
        return false;
    }
}

export type ResetRequestResult =
    | { message: string; errors?: undefined }
    | { message?: undefined; errors: string[] };

/** Ask for a link by email: the server's message -- the same for any address -- or why not. */
export const requestPasswordReset = (email: string) =>
    async (): Promise<ResetRequestResult> => {
        let response: Response;
        try {
            response = await sendJson("POST", "/api/auth/password-reset", { email });
        } catch {
            return { errors: [NETWORK_ERROR] };
        }
        if (!response.ok) {
            return { errors: await parseErrors(response, "Couldn't send the email. Please try again.") };
        }
        return { message: (await response.json()).message };
    };

/** Whether a link is still good: null if so, or why it isn't. */
export const checkResetToken = (token: string) =>
    async (): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson("POST", "/api/auth/password-reset/check", { token });
        } catch {
            return [NETWORK_ERROR];
        }
        return response.ok ? null : parseErrors(response, "Couldn't check this link. Please try again.");
    };

/** Choose the new password. Null once done -- and signed in -- or the messages to show. */
export const resetPassword = (token: string, newPassword: string) =>
    async (dispatch: AppDispatch): Promise<string[] | null> => {
        let response: Response;
        try {
            response = await sendJson("PUT", "/api/auth/password-reset", { token, new_password: newPassword });
        } catch {
            return [NETWORK_ERROR];
        }
        if (!response.ok) {
            return parseErrors(response, "Couldn't reset your password. Please try again.");
        }
        dispatch(setUser(await response.json()));
        return null;
    };
