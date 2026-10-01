import { useCallback, useEffect, useRef, useState } from "react";

type Finder = () => HTMLElement | null | undefined;

/**
 * Somewhere for focus to go once the page has caught up (#131). Removing a
 * photo removes the button that had focus, and the browser drops it on the
 * page itself, so a keyboard has to start again from the top. Pass a
 * function that finds the new place; it runs after the next render has
 * reached the page, when what it looks for is there.
 */
export function useFocusAfterRender(): (find: Finder) => void {
    const finder = useRef<Finder | null>(null);
    const [request, setRequest] = useState(0);

    useEffect(() => {
        const find = finder.current;
        finder.current = null;
        find?.()?.focus();
    }, [request]);

    return useCallback((find: Finder) => {
        finder.current = find;
        setRequest((n) => n + 1);
    }, []);
}
