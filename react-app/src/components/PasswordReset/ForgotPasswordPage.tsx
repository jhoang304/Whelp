import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import "./PasswordReset.css";
import FormErrors from "../FormErrors";
import { pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useAppDispatch } from "../../store";
import { requestPasswordReset } from "../../store/passwordReset";

const ERRORS_ID = "forgot-password-errors";

/**
 * /forgot-password: the address to email a reset link to. The login page's
 * "Forgot your password?" brings what was typed there.
 *
 * What comes back is the same for any address, so the page can't say
 * whether it has an account -- only that if it does, the email is on its way.
 */
function ForgotPasswordPage(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const location = useLocation<{ email?: unknown } | undefined>();
    const [email, setEmail] = useState(() =>
        typeof location.state?.email === "string" ? location.state.email : "");
    const [errors, setErrors] = useState<string[]>([]);
    const [sent, setSent] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    useDocumentTitle(pageTitle("Reset your password"));

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim()) {
            setErrors(["Enter your email address."]);
            return;
        }
        setSending(true);
        const result = await dispatch(requestPasswordReset(email));
        setSending(false);
        if (result.errors) {
            setErrors(result.errors);
            return;
        }
        setErrors([]);
        setSent(result.message);
    };

    return (
        <div className="password-reset">
            <h1>Reset your password</h1>
            {sent ? (
                <>
                    <p className="password-reset-sent" role="status">{sent}</p>
                    <p>
                        Nothing yet? Check your spam folder, or{" "}
                        <button type="button" className="password-reset-again" onClick={() => setSent(null)}>
                            try a different address
                        </button>.
                    </p>
                </>
            ) : (
                <form onSubmit={submit} noValidate>
                    <p>Enter the email address you signed up with, and we'll email you a link to choose a new password.</p>
                    <FormErrors errors={errors} id={ERRORS_ID} className="password-reset-errors" />
                    <label htmlFor="reset-email">Email Address</label>
                    <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        {...(errors.length > 0 ? { "aria-invalid": true, "aria-describedby": ERRORS_ID } : {})}
                    />
                    <button type="submit" className="password-reset-primary" disabled={sending}>
                        {sending ? "Sending..." : "Email me a link"}
                    </button>
                </form>
            )}
            <p className="password-reset-footer">
                <Link to="/login">Back to log in</Link>
            </p>
        </div>
    );
}

export default ForgotPasswordPage;
