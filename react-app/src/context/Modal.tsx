import React, { useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

interface ModalContextValue {
  /** The div the modal is portalled into. */
  modalRef: React.RefObject<HTMLDivElement>;
  modalContent: React.ReactNode;
  setModalContent: (content: React.ReactNode) => void;
  /** Called once the modal closes. Pass null to clear it. */
  setOnModalClose: (callback: (() => void) | null) => void;
  closeModal: () => void;
}

const ModalContext = React.createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [onModalClose, setOnModalCloseState] = useState<(() => void) | null>(null);

  const setOnModalClose = useCallback((callback: (() => void) | null) => {
    // useState reads a function argument as an updater: setOnModalCloseState(cb)
    // would call cb immediately -- when the modal opens -- and store whatever it
    // returned. Stow it behind an updater so it is kept, not run.
    setOnModalCloseState(() => callback);
  }, []);

  const closeModal = useCallback(() => {
    setModalContent(null);
    if (onModalClose) {
      setOnModalCloseState(null);
      onModalClose();
    }
  }, [onModalClose]);

  const contextValue: ModalContextValue = {
    modalRef,
    modalContent,
    setModalContent,
    setOnModalClose,
    closeModal,
  };

  return (
    <>
      <ModalContext.Provider value={contextValue}>
        {children}
      </ModalContext.Provider>
      <div ref={modalRef} />
    </>
  );
}

export function Modal(): React.JSX.Element | null {
  const { modalRef, modalContent, closeModal } = useModal();
  // Nothing to portal into until the provider's div has mounted.
  if (!modalRef.current || !modalContent) return null;

  return createPortal(
    <div id="modal">
      <div id="modal-background" onClick={closeModal} />
      <div id="modal-content">
        {modalContent}
      </div>
    </div>,
    modalRef.current
  );
}

export const useModal = (): ModalContextValue => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used inside a ModalProvider');
  }
  return context;
};
