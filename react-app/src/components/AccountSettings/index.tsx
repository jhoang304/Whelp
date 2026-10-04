import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import "./AccountSettings.css";
import FormErrors from "../FormErrors";
import { pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    DeletionSummary, changePassword, connectGoogle, deleteAccount, disconnectGoogle, fetchDeletionSummary,
} from "../../store/account";
import { setUser } from "../../store/session";
import { useModal } from "../../context/Modal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import { GoogleLogo } from "../GoogleButton";
import { useGoogleOutcome, useGoogleStatus } from "../../hooks/useGoogle";
import { GOOGLE_CONFIRM_URL, navigateTo } from "../../utils/google";
import { authLink } from "../../utils/returnTo";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "../../utils/password";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * What an account made with Google shows instead of the password it doesn't
 * have: a fresh sign-in with Google, good for ten minutes.
 */
function ConfirmWithGoogle(): React.JSX.Element {
    return (
        <a className="google-button" href={GOOGLE_CONFIRM_URL}>
            <GoogleLogo />
            <span>Confirm with Google</span>
        </a>
    );
}

/**
 * /settings: change your password, connect Google, or delete your account.
 *
 * A page rather than more of the Edit profile modal, because deleting needs
 * a confirmation of its own, and the app has one modal at a time.
 */
function AccountSettings(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const { setModalContent } = useModal();
    const sessionUser = useAppSelector((state) => state.session.user);
    // So "Log in" comes back here (#135).
    const location = useLocation();
    // Back from Google: connected, confirmed, or why not.
    const googleOutcome = useGoogleOutcome();
    const google = useGoogleStatus();

    useDocumentTitle(pageTitle("Account settings"));
    const [summary, setSummary] = useState<DeletionSummary | null>(null);
    const [summaryErrors, setSummaryErrors] = useState<string[]>([]);

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [changing, setChanging] = useState(false);

    const [connectPassword, setConnectPassword] = useState("");
    const [connectErrors, setConnectErrors] = useState<string[]>([]);
    const [connecting, setConnecting] = useState(false);
    const [disconnectErrors, setDisconnectErrors] = useState<string[]>([]);
    const [disconnecting, setDisconnecting] = useState(false);

    const [deletePassword, setDeletePassword] = useState("");
    const [deleteErrors, setDeleteErrors] = useState<string[]>([]);
    const [deleting, setDeleting] = useState(false);
    const [deleted, setDeleted] = useState(false);

    const userId = sessionUser?.id;

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        dispatch(fetchDeletionSummary(userId)).then((result) => {
            if (cancelled) return;
            if (result.errors) setSummaryErrors(result.errors);
            else setSummary(result.summary);
        });
        return () => {
            cancelled = true;
        };
    }, [dispatch, userId]);

    if (deleted) {
        return (
            <div className="account-settings">
                <h1>Your account has been deleted</h1>
                <p role="status">
                    Everything you owned on Whelp is gone. The reviews you wrote stay, shown as by "Deleted user".
                </p>
                <Link to="/" className="account-settings-home">Back to Whelp</Link>
            </div>
        );
    }

    if (!sessionUser || !userId) {
        return (
            <div className="account-settings">
                <h1>Account settings</h1>
                <p>
                    <Link to={authLink("/login", location)}>Log in</Link> to change your password or delete your account.
                </p>
            </div>
        );
    }

    const isDemo = !!summary?.isDemo;
    // Only an account made with Google says it has none.
    const hasPassword = sessionUser.hasPassword !== false;
    const googleConnected = !!sessionUser.googleConnected;
    // Signed in with Google in the last ten minutes: what a passwordless
    // account sets a password or deletes itself with.
    const confirmed = !!google?.confirmed;

    const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordMessage(null);
        // The same rules the API applies, checked first so the common slips
        // cost no round trip. The API still has the last word.
        const problems: string[] = [];
        if (hasPassword && !current) problems.push("Enter your current password.");
        if (next.length < PASSWORD_MIN_LENGTH) problems.push(PASSWORD_TOO_SHORT);
        if (next !== confirm) problems.push("The new passwords don't match.");
        if (hasPassword && next && next === current) {
            problems.push("Choose a new password that is different from your current one.");
        }
        if (problems.length) {
            setPasswordErrors(problems);
            return;
        }

        setChanging(true);
        const errors = await dispatch(changePassword(userId, hasPassword ? current : null, next));
        setChanging(false);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        setPasswordErrors([]);
        setCurrent("");
        setNext("");
        setConfirm("");
        if (hasPassword) {
            setPasswordMessage("Your password has been changed.");
        } else {
            setPasswordMessage("Your password has been set. You can log in with it as well as with Google.");
            dispatch(setUser({ ...sessionUser, hasPassword: true }));
        }
    };

    const startConnecting = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!connectPassword) {
            setConnectErrors(["Enter your password to connect Google."]);
            return;
        }
        setConnecting(true);
        const result = await dispatch(connectGoogle(connectPassword));
        if (result.errors) {
            setConnecting(false);
            setConnectErrors(result.errors);
            return;
        }
        // Off to Google, which sends the browser back here. "Connecting..."
        // stays until the page goes.
        navigateTo(result.url);
    };

    const disconnect = async () => {
        setDisconnecting(true);
        const errors = await dispatch(disconnectGoogle());
        setDisconnecting(false);
        setDisconnectErrors(errors ?? []);
    };

    const performDelete = async () => {
        setDeleting(true);
        const errors = await dispatch(deleteAccount(userId, hasPassword ? deletePassword : null));
        setDeleting(false);
        if (errors) {
            setDeleteErrors(errors);
            return;
        }
        setDeleted(true);
    };

    const askToDelete = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (hasPassword && !deletePassword) {
            setDeleteErrors(["Enter your password to delete your account."]);
            return;
        }
        setDeleteErrors([]);
        setModalContent(
            <ConfirmDeleteModal
                title="Delete your account?"
                message="This can't be undone."
                detail={summary && summary.restaurants.length > 0
                    ? `Your ${plural(summary.restaurants.length, "restaurant")} and everything on them will be deleted with it.`
                    : "Your photos and saved restaurants will be deleted with it."}
                confirmLabel="Delete my account"
                onConfirm={performDelete}
            />
        );
    };

    return (
        <div className="account-settings">
            <h1>Account settings</h1>

            {isDemo && (
                <p className="account-settings-demo" role="note">
                    This is the shared demo account, so its password can't be changed, it can't connect a
                    Google account, and it can't be deleted. Sign up for your own account to try these.
                </p>
            )}

            <div className="account-settings-outcome">
                <FormErrors errors={googleOutcome.problem ? [googleOutcome.problem] : []}
                    className="account-settings-errors" />
                {googleOutcome.success && (
                    <p className="account-settings-success" role="status">{googleOutcome.success}</p>
                )}
            </div>

            <section className="account-settings-section" aria-labelledby="change-password-heading">
                <h2 id="change-password-heading">{hasPassword ? "Change password" : "Set a password"}</h2>
                {!hasPassword && !confirmed ? (
                    <div className="account-settings-confirm">
                        <p>
                            You log in with Google. To log in with your email address and a password as well,
                            confirm it's you with Google, then choose one.
                        </p>
                        <ConfirmWithGoogle />
                    </div>
                ) : (
                    <form onSubmit={submitPassword} noValidate>
                        <FormErrors errors={passwordErrors} className="account-settings-errors" />
                        {passwordMessage && (
                            <p className="account-settings-success" role="status">{passwordMessage}</p>
                        )}
                        {hasPassword && (
                            <label>
                                <span>Current password</span>
                                <input type="password" autoComplete="current-password" value={current}
                                    onChange={(e) => setCurrent(e.target.value)} disabled={isDemo} />
                            </label>
                        )}
                        <label>
                            <span>New password</span>
                            <input type="password" autoComplete="new-password" value={next}
                                onChange={(e) => setNext(e.target.value)} disabled={isDemo}
                                aria-describedby="new-password-rule" />
                        </label>
                        <p id="new-password-rule" className="account-settings-hint">
                            At least {PASSWORD_MIN_LENGTH} characters.
                        </p>
                        <label>
                            <span>Confirm new password</span>
                            <input type="password" autoComplete="new-password" value={confirm}
                                onChange={(e) => setConfirm(e.target.value)} disabled={isDemo} />
                        </label>
                        <button type="submit" className="account-settings-primary" disabled={isDemo || changing}>
                            {hasPassword
                                ? (changing ? "Changing..." : "Change password")
                                : (changing ? "Setting..." : "Set password")}
                        </button>
                    </form>
                )}
            </section>

            {(googleConnected || google?.available) && (
                <section className="account-settings-section" aria-labelledby="google-heading">
                    <h2 id="google-heading">Google</h2>
                    {googleConnected ? (
                        <div className="account-settings-google">
                            <p>
                                {hasPassword
                                    ? "Your Google account is connected: you can log in with it or with your password."
                                    : "Your Google account is connected, and it's how you log in."}
                            </p>
                            {hasPassword && (
                                <>
                                    <FormErrors errors={disconnectErrors} className="account-settings-errors" />
                                    <button type="button" className="account-settings-secondary" onClick={disconnect}
                                        disabled={disconnecting}>
                                        {disconnecting ? "Disconnecting..." : "Disconnect Google"}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={startConnecting} noValidate>
                            <p>Connect a Google account to log in with it as well as your password.</p>
                            <FormErrors errors={connectErrors} className="account-settings-errors" />
                            <label>
                                <span>Password</span>
                                <input type="password" autoComplete="current-password" value={connectPassword}
                                    onChange={(e) => setConnectPassword(e.target.value)} disabled={isDemo} />
                            </label>
                            <button type="submit" className="google-button" disabled={isDemo || connecting}>
                                <GoogleLogo />
                                <span>{connecting ? "Connecting..." : "Connect Google"}</span>
                            </button>
                        </form>
                    )}
                </section>
            )}

            <section className="account-settings-section account-settings-danger" aria-labelledby="delete-account-heading">
                <h2 id="delete-account-heading">Delete account</h2>
                {summaryErrors.length > 0 && (
                    <p className="account-settings-errors" role="alert">{summaryErrors[0]}</p>
                )}
                {summary && (
                    <>
                        <p>Deleting your account removes:</p>
                        <ul className="account-settings-list">
                            <li>Your profile and profile picture.</li>
                            {summary.restaurants.length > 0 && (
                                <li>
                                    {summary.restaurants.length === 1 ? "Your restaurant" : "Your restaurants"}, with all of
                                    their photos, reviews and hours:
                                    <ul>
                                        {summary.restaurants.map((restaurant) => (
                                            <li key={restaurant.id}>
                                                <Link to={`/single/${restaurant.id}`}>{restaurant.name}</Link>
                                                {" "}({plural(restaurant.reviews, "review")})
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            )}
                            {summary.photos > 0 && <li>{plural(summary.photos, "photo")} you added.</li>}
                            {summary.favorites > 0 && <li>{plural(summary.favorites, "saved restaurant")}.</li>}
                        </ul>
                        {summary.reviewsKept > 0 && (
                            <p>
                                {summary.reviewsKept === 1 ? "The review you wrote stays" : `The ${summary.reviewsKept} reviews you wrote stay`},
                                shown as by "Deleted user", so the restaurants keep their ratings.
                            </p>
                        )}
                    </>
                )}
                {!hasPassword && !confirmed ? (
                    <div className="account-settings-confirm">
                        <p>Confirm it's you with Google to delete your account.</p>
                        <ConfirmWithGoogle />
                    </div>
                ) : (
                    <form onSubmit={askToDelete} noValidate>
                        <FormErrors errors={deleteErrors} className="account-settings-errors" />
                        {hasPassword && (
                            <label>
                                <span>Your password</span>
                                <input type="password" autoComplete="current-password" value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)} disabled={isDemo} />
                            </label>
                        )}
                        <button type="submit" className="account-settings-delete" disabled={isDemo || deleting}>
                            {deleting ? "Deleting..." : "Delete my account"}
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
}

export default AccountSettings;
