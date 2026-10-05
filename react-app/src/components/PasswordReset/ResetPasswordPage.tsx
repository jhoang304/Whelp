import React, { useEffect, useState } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";

import "./PasswordReset.css";
import FormErrors from "../FormErrors";
import { pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useAppDispatch } from "../../store";
import { checkResetToken, resetPassword } from "../../store/passwordReset";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "../../utils/password";

const INCOMPLETE = "This link is incomplete. Open the one in the email again.";

type Stage = "checking" | "unusable" | "ready" | "done";

const TITLES: Record<Stage, string> = {
    checking: "Reset your password",
    unusable: "This link can't be used",
    ready: "Choose a new password",
    done: "Your password has been reset",
};

/**
 * /reset-password#<token>: where the email's link lands. The token is after
 * the #, which the browser never sends anywhere; the page reads it, takes
 * it out of the address bar, checks it, and asks for the new password.
 */
function ResetPasswordPage(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const location = useLocation();
    const history = useHistory();
    // Read once: it is a way into the account, so it doesn't stay in the
    // address bar, or in the history entry, for longer than that.
    const [token] = useState(() => location.hash.replace(/^#/, ""));
    useEffect(() => {
        if (location.hash) history.replace({ ...location, hash: "" });
    }, [history, location]);

    const [stage, setStage] = useState<Stage>(token ? "checking" : "unusable");
    const [problem, setProblem] = useState(token ? "" : INCOMPLETE);
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [errors, setErrors] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    useDocumentTitle(pageTitle(TITLES[stage]));

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        dispatch(checkResetToken(token)).then((refused) => {
            if (cancelled) return;
            if (refused) {
                setProblem(refused[0]);
                setStage("unusable");
            } else {
                setStage("ready");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, token]);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const problems: string[] = [];
        if (next.length < PASSWORD_MIN_LENGTH) problems.push(PASSWORD_TOO_SHORT);
        if (next !== confirm) problems.push("The new passwords don't match.");
        if (problems.length) {
            setErrors(problems);
            return;
        }
        setSaving(true);
        const refused = await dispatch(resetPassword(token, next));
        setSaving(false);
        if (refused) {
            setErrors(refused);
            return;
        }
        setStage("done");
    };

    return (
        <div className="password-reset">
            <h1>{TITLES[stage]}</h1>
            {stage === "checking" && <p role="status">Checking your link...</p>}

            {stage === "unusable" && (
                <>
                    <p>{problem}</p>
                    <Link to="/forgot-password" className="password-reset-primary">Ask for a new link</Link>
                </>
            )}

            {stage === "ready" && (
                <form onSubmit={submit} noValidate>
                    <FormErrors errors={errors} className="password-reset-errors" />
                    <label htmlFor="reset-new-password">New password</label>
                    <input id="reset-new-password" type="password" autoComplete="new-password" value={next}
                        onChange={(e) => setNext(e.target.value)} aria-describedby="reset-password-rule" />
                    <p id="reset-password-rule" className="password-reset-hint">At least {PASSWORD_MIN_LENGTH} characters.</p>
                    <label htmlFor="reset-confirm-password">Confirm new password</label>
                    <input id="reset-confirm-password" type="password" autoComplete="new-password" value={confirm}
                        onChange={(e) => setConfirm(e.target.value)} />
                    <button type="submit" className="password-reset-primary" disabled={saving}>
                        {saving ? "Saving..." : "Set new password"}
                    </button>
                </form>
            )}

            {stage === "done" && (
                <>
                    <p className="password-reset-sent" role="status">You're logged in with your new password.</p>
                    <Link to="/" className="password-reset-primary">Go to Whelp</Link>
                </>
            )}
        </div>
    );
}

export default ResetPasswordPage;
