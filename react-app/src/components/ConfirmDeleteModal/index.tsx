import React from "react";
import { useModal } from "../../context/Modal";
import "./ConfirmDeleteModal.css";

interface ConfirmDeleteModalProps {
    restaurantName: string;
    onConfirm: () => void;
}

function ConfirmDeleteModal({ restaurantName, onConfirm }: ConfirmDeleteModalProps): React.JSX.Element {
    const { closeModal } = useModal();

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };

    return (
        <div className="confirm-delete-modal">
            <div className="confirm-delete-header">
                <i className="fa-solid fa-triangle-exclamation warning-icon"></i>
                <h2>Delete Restaurant</h2>
            </div>
            <div className="confirm-delete-content">
                <p>
                    Are you sure you want to delete <strong>"{restaurantName}"</strong>?
                </p>
                <p className="warning-text">
                    This action cannot be undone. All reviews and photos associated with this restaurant will also be permanently deleted.
                </p>
            </div>
            <div className="confirm-delete-buttons">
                <button 
                    className="cancel-button" 
                    onClick={handleCancel}
                >
                    Cancel
                </button>
                <button 
                    className="delete-button" 
                    onClick={handleConfirm}
                >
                    <i className="fa-solid fa-trash"></i>
                    Delete Restaurant
                </button>
            </div>
        </div>
    );
}

export default ConfirmDeleteModal;