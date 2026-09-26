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

/** How long a closing modal stays to fade out. Matches Modal.css. */
export const FADE_OUT_MS = 160;

/**
 * Whether to fade at all. Not for anyone who has asked their system for less
 * motion, and not where there is no way to ask -- a closing modal then goes at
 * once, as it always used to.
 */
const motionAllowed = (): boolean =>
  typeof window.matchMedia === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Modal(): React.JSX.Element | null {
  const { modalRef, modalContent, closeModal } = useModal();
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const open = !!modalRef.current && !!modalContent;

  // The content last shown, kept after the modal closes for as long as it
  // takes to fade out. Rendering it in the same place keeps its state, so a
  // form fades out as it was rather than blanking first.
  const [fading, setFading] = useState<React.ReactNode>(null);
  const shown = modalContent || fading;
  const closing = !modalContent && !!fading;

  // Focus in, Tab kept inside, Escape to close, focus back out afterwards --
  // at the moment it closes, not once it has finished fading.
  useDialog(contentRef, open, closeModal);

  useLayoutEffect(() => {
    if (modalContent) {
      setFading(modalContent);
      return;
    }
    if (!fading) return;
    if (!motionAllowed()) {
      setFading(null);
      return;
    }
    // Opened again mid-fade, and the cleanup cancels this.
    const timer = window.setTimeout(() => setFading(null), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [modalContent, fading]);

  useLayoutEffect(() => {
    // While it fades, nothing in it can take focus or clicks: Tab must not
    // wander back into a dialog that has already closed. After useDialog's
    // effect above, which has already sent focus back out.
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (closing) overlay.setAttribute('inert', '');
    else overlay.removeAttribute('inert');
  }, [closing]);

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
  if (!modalRef.current || !shown) return null;

  return createPortal(
    <div id="modal" ref={overlayRef} className={closing ? 'closing' : undefined}>
      <div id="modal-background" onClick={closeModal} />
      <div id="modal-content" ref={contentRef} role="dialog" aria-modal="true" tabIndex={-1}>
        {/* The scrolling happens in here, not on the rounded box around it:
            see .modal-scroll in Modal.css. */}
        <div className="modal-scroll">
          {shown}
        </div>
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
