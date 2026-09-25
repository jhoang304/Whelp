import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';
import { useDialog } from '../hooks/useDialog';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const open = !!modalRef.current && !!modalContent;

  // Focus in, Tab kept inside, Escape to close, focus back out afterwards.
  useDialog(contentRef, open, closeModal);

  useLayoutEffect(() => {
    // Every modal opens with a heading, and that heading is the dialog's name:
    // "Add Restaurant, dialog" rather than just "dialog". The modals are
    // written without knowing they will be wrapped, so the wrapper finds it --
    // and looks again whenever the content changes, since some show a
    // "Loading..." with no heading first. React never set these attributes,
    // so it will not fight over them.
    const content = contentRef.current;
    if (!open || !content) return;
    const name = () => {
      const heading = content.querySelector('h1, h2, h3');
      if (!heading) {
        content.removeAttribute('aria-labelledby');
        return;
      }
      if (!heading.id) heading.id = 'modal-title';
      content.setAttribute('aria-labelledby', heading.id);
    };
    name();
    // Only added and removed nodes: the attributes set above are not
    // watched, so naming the dialog cannot set this off again.
    const observer = new MutationObserver(name);
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open]);

  // Nothing to portal into until the provider's div has mounted.
  if (!open) return null;

  return createPortal(
    <div id="modal">
      <div id="modal-background" onClick={closeModal} />
      <div id="modal-content" ref={contentRef} role="dialog" aria-modal="true" tabIndex={-1}>
        {modalContent}
      </div>
    </div>,
    modalRef.current as HTMLDivElement
  );
}

export const useModal = (): ModalContextValue => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used inside a ModalProvider');
  }
  return context;
};
