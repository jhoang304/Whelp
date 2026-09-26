import { RefObject, useLayoutEffect, useRef } from "react";

const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The dialogs open right now, innermost last. Only the last one hears keys. */
const openDialogs: object[] = [];

/**
 * What Tab can reach inside `container`, in order.
 *
 * Something inside a `display: none` box matches the selector but cannot take
 * focus, so wrapping to it would strand the reader. Rendered boxes are what
 * count -- except under jsdom, which renders nothing, so every element looks
 * hidden there; when nothing at all looks rendered, the selector's answer is
 * used as it stands.
 */
function tabbable(container: HTMLElement): HTMLElement[] {
    const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    const rendered = all.filter((element) => element.getClientRects().length > 0);
    return rendered.length > 0 ? rendered : all;
}

/**
 * Makes `ref` behave as a modal dialog while `active` is true.
 *
 * - Focus moves into it when it opens: to whatever carries data-autofocus,
 *   else the first thing that can take it, else the container itself (which
 *   should carry tabIndex={-1}), unless something inside already has it.
 *   data-autofocus rather than React's autoFocus, which moves focus before
 *   this can note what had it, and so what to give it back to.
 * - Tab and Shift+Tab wrap at its edges instead of walking out onto the page
 *   underneath.
 * - Escape calls `onClose`.
 * - When it closes, focus goes back to whatever had it before, if that is
 *   still on the page and focus is still the dialog's to give. A menu item
 *   that opened it and has since been hidden cannot take focus, and the
 *   browser quietly declines. A dialog can go inactive while it is still on
 *   the page -- the modal stays a moment to fade out -- and focus goes back
 *   at that moment, not when it finally leaves.
 *
 * Dialogs can open inside dialogs (a photo, enlarged, from the photos modal),
 * so only the innermost one answers the keyboard: Escape closes the photo and
 * leaves the modal it came from open.
 */
export function useDialog(ref: RefObject<HTMLElement>, active: boolean, onClose: () => void): void {
    // Read through a ref, so a new onClose each render does not tear the
    // listeners down and put them back.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Who had focus when the dialog opened, and the dialog itself, kept past
    // the effect that noted them: focus goes back after that effect is gone.
    const openerRef = useRef<HTMLElement | null>(null);
    const openedRef = useRef<HTMLElement | null>(null);

    const giveFocusBack = () => {
        const opener = openerRef.current;
        const dialog = openedRef.current;
        openerRef.current = null;
        openedRef.current = null;
        if (!opener || !opener.isConnected) return;
        // Only if focus is still the dialog's to give. Whatever closed it may
        // have sent focus somewhere on purpose -- the profile menu hands it to
        // its own button -- and that wins.
        const current = document.activeElement;
        const stillOurs = !current || current === document.body || (!!dialog && dialog.contains(current));
        if (stillOurs) opener.focus();
    };

    // A layout effect, so focus has moved before the browser paints the dialog
    // and before any child's passive effect can look at document.activeElement.
    useLayoutEffect(() => {
        const container = ref.current;
        if (!active || !container) {
            // Just closed, and perhaps still on the page to fade out. This runs
            // in the layout phase, after React has put back whatever focus it
            // saw before the commit -- which, with the dialog still on the
            // page, would be the field inside it -- so this is the last word.
            giveFocusBack();
            return;
        }

        const token = {};
        openDialogs.push(token);

        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        openedRef.current = container;
        if (!container.contains(document.activeElement)) {
            const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
            (preferred || tabbable(container)[0] || container).focus();
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== token || event.defaultPrevented) return;

            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }

            if (event.key !== "Tab") return;
            const reachable = tabbable(container);
            if (reachable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }
            const first = reachable[0];
            const last = reachable[reachable.length - 1];
            const current = document.activeElement;
            const outside = !container.contains(current);
            if (event.shiftKey && (outside || current === first || current === container)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (outside || current === last)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            openDialogs.splice(openDialogs.indexOf(token), 1);
        };
    }, [ref, active]);

    // Unmounted while still open -- the photo viewer simply goes -- so the
    // branch above never runs; give focus back here instead. This runs before
    // the dialog's elements leave the page, while focus is still inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => () => giveFocusBack(), []);
}
