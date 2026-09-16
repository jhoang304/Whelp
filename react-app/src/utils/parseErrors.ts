/**
 * Read the API's error messages off a failed response.
 *
 * Every failure answers `{"errors": [message, ...]}` -- a flat list of strings
 * meant to be rendered as-is. `fallback` covers the cases that carry no such
 * body: a proxy's HTML 502, a dropped connection mid-read, an empty 500. The
 * caller always gets at least one message to show.
 */
export const parseErrors = async (res: Response, fallback: string): Promise<string[]> => {
    const data = await res.json().catch(() => ({}));
    const errors = (data as { errors?: unknown })?.errors;

    if (Array.isArray(errors) && errors.length > 0) {
        return errors.map((message) => String(message));
    }
    return [fallback];
};
