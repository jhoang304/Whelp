/**
 * The password rule, in one place for the signup page and the signup modal.
 *
 * Mirrored from app/forms/signup_form.py; tests/test_hardening.py reads the
 * number out of this file and fails if the two disagree.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_TOO_SHORT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
