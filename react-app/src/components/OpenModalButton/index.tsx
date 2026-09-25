import React from 'react';
import { useModal } from '../../context/Modal';

interface OpenModalButtonProps {
  modalComponent: React.ReactElement; // component to render inside the modal
  buttonText: React.ReactNode; // text (or icon + text) of the button that opens the modal
  onButtonClick?: () => void; // optional: callback function that will be called once the button that opens the modal is clicked
  onModalClose?: () => void; // optional: callback function that will be called once the modal is closed
  className?: string;
}

function OpenModalButton({
  modalComponent,
  buttonText,
  onButtonClick,
  onModalClose,
  className
}: OpenModalButtonProps): React.JSX.Element {
  const { setModalContent, setOnModalClose } = useModal();

  const onClick = () => {
    if (onModalClose) setOnModalClose(onModalClose);
    setModalContent(modalComponent);
    if (onButtonClick) onButtonClick();
  };

  // type="button": without it a button inside a form submits the form.
  return (
    <button type="button" onClick={onClick} className={className}>{buttonText}</button>
  );
}

export default OpenModalButton;