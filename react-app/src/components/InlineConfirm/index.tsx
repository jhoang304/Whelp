import React, { useEffect, useId, useRef } from "react";
import "./InlineConfirm.css";

interface InlineConfirmProps {
    /** The question, and so the group's name: "Remove this photo?" */
    question: string;
    /** The consequence, in smaller print. */
    detail?: string;
    /** What the red button says. */
    confirmLabel: string;
    /** What it says while the delete is under way. */
    busyLabel: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    className?: string;
}

/**
 * "Are you sure?" asked where the button was, for a delete inside something
 * already open -- a photo in the photos modal, a photo on the review being
 * edited -- where a second modal on top would be one too many (#131).
 *
 * Focus moves to Cancel when it opens, as ConfirmDeleteModal's does: Enter
 * straight after asking should never be the thing that deletes. Escape is
 * Cancel too, and it stops there: inside the photos modal it would otherwise
 * close the whole modal. When the question goes, focus goes back to the
 * button that asked it, if that is still on the page; a delete that went
 * through took that button with it, and the caller says where focus goes.
 *
 * While the delete is under way the buttons say so and ignore clicks, but
 * stay enabled: a disabled button drops the focus it has, and a delete the
 * server refuses leaves the question up, with focus still on Remove to try
 * again.
 */
function InlineConfirm({
    question, detail, confirmLabel, busyLabel, busy = false, onConfirm, onCancel, className,
}: InlineConfirmProps): React.JSX.Element {
    const questionId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
            ? document.activeElement
            : null;
        const container = containerRef.current;
        cancelRef.current?.focus();
        return () => {
            // Only if focus would otherwise be lost: whatever closed it may
            // have sent focus somewhere on purpose, and that wins.
            const current = document.activeElement;
            const lost = !current || current === document.body || (!!container && container.contains(current));
            if (lost && opener && opener.isConnected) opener.focus();
        };
    }, []);

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Escape") return;
        // Ahead of the modal's own Escape, which looks for this.
        event.preventDefault();
        if (!busy) onCancel();
    };

    return (
        <div
            ref={containerRef}
            className={className ? `inline-confirm ${className}` : "inline-confirm"}
            role="group"
            aria-labelledby={questionId}
            onKeyDown={onKeyDown}
        >
            <p id={questionId} className="inline-confirm-question">{question}</p>
            {detail && <p className="inline-confirm-detail">{detail}</p>}
            <div className="inline-confirm-buttons">
                <button
                    type="button"
                    ref={cancelRef}
                    className="inline-confirm-cancel"
                    onClick={() => { if (!busy) onCancel(); }}
                    aria-disabled={busy || undefined}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="inline-confirm-confirm"
                    onClick={() => { if (!busy) onConfirm(); }}
                    aria-disabled={busy || undefined}
                >
                    <i className={busy ? "fa-solid fa-spinner fa-spin" : "fa-regular fa-trash-can"} aria-hidden="true"></i>
                    {busy ? busyLabel : confirmLabel}
                </button>
            </div>
        </div>
    );
}

export default InlineConfirm;
