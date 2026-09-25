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
 *   still on the page. A menu item that opened it and has since been hidden
 *   cannot take focus, and the browser quietly declines.
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

    // A layout effect, so focus has moved before the browser paints the dialog
    // and before any child's passive effect can look at document.activeElement.
    useLayoutEffect(() => {
        const container = ref.current;
        if (!active || !container) return;

        const token = {};
        openDialogs.push(token);

        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
            // If whatever closed the dialog moved focus somewhere first -- the
            // profile menu hands it to its own button -- that wins without any
            // check here: this runs during React's commit, and React puts back
            // the focus it saw before the commit whenever that element is still
            // on the page. A focused control inside the dialog is not, so the
            // usual close lands here.
            if (opener && opener.isConnected) opener.focus();
        };
    }, [ref, active]);
}
