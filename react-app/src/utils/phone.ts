/**
 * The one phone rule for the client, mirroring `app/forms/phone.py` so the
 * two forms and the server agree.
 *
 * What it replaces was "must contain a digit", which is what was left after an
 * allowlist of digits, spaces, hyphens and parentheses turned out to reject
 * `+1 555 123 4567` -- for want of a plus. That was the right thing to loosen
 * and the wrong amount: it also accepts `(346) 571-7931asdf`.
 *
 * So: the punctuation the world writes numbers with, and no letters, except
 * an extension on the end. A vanity number such as 1-800-FLOWERS is rejected
 * -- the one legitimate thing this turns away, and dialling it means typing
 * the digits anyway.
 */

/** `x99`, `ext 99`, `ext. 99`, after a comma, semicolon or space. */
export const PHONE_EXTENSION = /(?:[,;]|\s)*(?:ext|extn|x)\.?\s*\d+\s*$/i;
export const PHONE_CHARACTERS = /^[\d+()\-./\s]+$/;
export const PHONE_MESSAGE =
    "Phone number can contain digits and + ( ) - . / only, with an optional extension (e.g. (555) 555-5555 x99)";

/** The number without a trailing extension, which may carry letters. */
export function stripExtension(value: string): string {
    return value.replace(PHONE_EXTENSION, "").trim();
}

export function isValidPhone(value: string | null | undefined): boolean {
    return PHONE_CHARACTERS.test(stripExtension(String(value ?? "")));
}
