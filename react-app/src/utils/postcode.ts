/**
 * The one postcode rule for the client, mirroring `app/forms/postcode.py`
 * so the two forms and the server agree. Alphanumeric groups joined by
 * single spaces or hyphens, 3-10 characters: 02134, 77003-1234, M5V 3L9 and
 * SW1A 1AA pass; !!!, A--B, AB and a trailing space do not.
 */
export const POSTCODE_PATTERN = /^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$/;
export const POSTCODE_MIN = 3;
export const POSTCODE_MAX = 10;
export const POSTCODE_MESSAGE =
    "Postal code must be 3-10 letters or digits, separated by single spaces or hyphens (e.g. 02134, 77003-1234, M5V 3L9)";

export function isValidPostcode(value: string | number | null | undefined): boolean {
    const trimmed = String(value ?? "").trim();
    return (
        trimmed.length >= POSTCODE_MIN &&
        trimmed.length <= POSTCODE_MAX &&
        POSTCODE_PATTERN.test(trimmed)
    );
}
