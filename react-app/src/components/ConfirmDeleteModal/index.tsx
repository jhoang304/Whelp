import React from "react";
import { useModal } from "../../context/Modal";
import "./ConfirmDeleteModal.css";

interface ConfirmDeleteModalProps {
    /** The heading, and so the dialog's name: "Delete Restaurant". */
    title: string;
    /** The question itself. */
    message: React.ReactNode;
    /** The consequence, in smaller print. */
    detail?: string;
    /** What the red button says; it should name the thing going. */
    confirmLabel: string;
    onConfirm: () => void;
}

/**
 * "Are you sure?" before anything is deleted.
 *
 * Restaurants had this and reviews and responses had window.confirm: a
 * browser box that cannot be styled, reads differently in every browser, and
 * some embedded browsers suppress outright -- where it returns false, and the
 * delete button silently does nothing. One modal for all three.
 *
 * Cancel comes first, so it is what focus lands on when the modal opens:
 * Enter straight after opening should never be the thing that deletes.
 */
function ConfirmDeleteModal({ title, message, detail, confirmLabel, onConfirm }: ConfirmDeleteModalProps): React.JSX.Element {
    const { closeModal } = useModal();

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    return (
        <div className="confirm-delete-modal">
            <div className="confirm-delete-header">
                <i className="fa-solid fa-triangle-exclamation warning-icon" aria-hidden="true"></i>
                <h2>{title}</h2>
            </div>
            <div className="confirm-delete-content">
                <p>{message}</p>
                {detail && <p className="warning-text">{detail}</p>}
            </div>
            <div className="confirm-delete-buttons">
                <button type="button" className="cancel-button" onClick={closeModal}>
                    Cancel
                </button>
                <button type="button" className="delete-button" onClick={handleConfirm}>
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                    {confirmLabel}
                </button>
            </div>
        </div>
    );
}

export default ConfirmDeleteModal;
