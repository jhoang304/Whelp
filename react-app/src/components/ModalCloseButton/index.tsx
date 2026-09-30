import React from "react";
import { useModal } from "../../context/Modal";
import "./ModalCloseButton.css";

interface ModalCloseButtonProps {
    /** What it closes, for a screen reader: "Close Add Photo". */
    label: string;
}

/**
 * An X in the modal's corner (#122). Without one, the way out of a modal was
 * Escape or the narrow backdrop around it, and a touch screen reader has
 * neither. The modal it sits in needs position: relative.
 */
function ModalCloseButton({ label }: ModalCloseButtonProps): React.JSX.Element {
    const { closeModal } = useModal();
    return (
        <button type="button" className="modal-close-button" onClick={closeModal} aria-label={label}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
    );
}

export default ModalCloseButton;
