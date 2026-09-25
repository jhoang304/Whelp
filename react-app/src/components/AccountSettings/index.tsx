import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./AccountSettings.css";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    DeletionSummary, changePassword, deleteAccount, fetchDeletionSummary,
} from "../../store/account";
import { useModal } from "../../context/Modal";
import ConfirmDeleteModal from "../ConfirmDeleteModal";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "../../utils/password";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * /settings: change your password, or delete your account.
 *
 * A page rather than more of the Edit profile modal, because deleting needs
 * a confirmation of its own, and the app has one modal at a time.
 */
function AccountSettings(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const { setModalContent } = useModal();
    const sessionUser = useAppSelector((state) => state.session.user);

    const [summary, setSummary] = useState<DeletionSummary | null>(null);
    const [summaryErrors, setSummaryErrors] = useState<string[]>([]);

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [passwordChanged, setPasswordChanged] = useState(false);
    const [changing, setChanging] = useState(false);

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
            <main className="account-settings">
                <h1>Your account has been deleted</h1>
                <p role="status">
                    Everything you owned on Whelp is gone. The reviews you wrote stay, shown as by "Deleted user".
                </p>
                <Link to="/" className="account-settings-home">Back to Whelp</Link>
            </main>
        );
    }

    if (!sessionUser || !userId) {
        return (
            <main className="account-settings">
                <h1>Account settings</h1>
                <p>
                    <Link to="/login">Log in</Link> to change your password or delete your account.
                </p>
            </main>
        );
    }

    const isDemo = !!summary?.isDemo;

    const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordChanged(false);
        // The same rules the API applies, checked first so the common slips
        // cost no round trip. The API still has the last word.
        const problems: string[] = [];
        if (!current) problems.push("Enter your current password.");
        if (next.length < PASSWORD_MIN_LENGTH) problems.push(PASSWORD_TOO_SHORT);
        if (next !== confirm) problems.push("The new passwords don't match.");
        if (next && next === current) problems.push("Choose a new password that is different from your current one.");
        if (problems.length) {
            setPasswordErrors(problems);
            return;
        }

        setChanging(true);
        const errors = await dispatch(changePassword(userId, current, next));
        setChanging(false);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        setPasswordErrors([]);
        setCurrent("");
        setNext("");
        setConfirm("");
        setPasswordChanged(true);
    };

    const performDelete = async () => {
        setDeleting(true);
        const errors = await dispatch(deleteAccount(userId, deletePassword));
        setDeleting(false);
        if (errors) {
            setDeleteErrors(errors);
            return;
        }
        setDeleted(true);
    };

    const askToDelete = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!deletePassword) {
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
        <main className="account-settings">
            <h1>Account settings</h1>

            {isDemo && (
                <p className="account-settings-demo" role="note">
                    This is the shared demo account, so its password can't be changed and it can't be deleted.
                    Sign up for your own account to try these.
                </p>
            )}

            <section className="account-settings-section" aria-labelledby="change-password-heading">
                <h2 id="change-password-heading">Change password</h2>
                <form onSubmit={submitPassword} noValidate>
                    {passwordErrors.length > 0 && (
                        <ul className="account-settings-errors" role="alert">
                            {passwordErrors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                    )}
                    {passwordChanged && (
                        <p className="account-settings-success" role="status">Your password has been changed.</p>
                    )}
                    <label>
                        <span>Current password</span>
                        <input type="password" autoComplete="current-password" value={current}
                            onChange={(e) => setCurrent(e.target.value)} disabled={isDemo} />
                    </label>
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
                        {changing ? "Changing..." : "Change password"}
                    </button>
                </form>
            </section>

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
                <form onSubmit={askToDelete} noValidate>
                    {deleteErrors.length > 0 && (
                        <ul className="account-settings-errors" role="alert">
                            {deleteErrors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                    )}
                    <label>
                        <span>Your password</span>
                        <input type="password" autoComplete="current-password" value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)} disabled={isDemo} />
                    </label>
                    <button type="submit" className="account-settings-delete" disabled={isDemo || deleting}>
                        {deleting ? "Deleting..." : "Delete my account"}
                    </button>
                </form>
            </section>
        </main>
    );
}

export default AccountSettings;
