import { useCallback, useEffect, useState } from "react";
import { apiFetch, NETWORK_ERROR } from "../../utils/api";

export type ListState<T> =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; items: T[] };

/**
 * One of the home page's lists (#134), fetched for itself: each section
 * loads, fails and is tried again on its own, and none of them writes to the
 * store the listing page keeps its restaurants in -- six top-rated ones
 * there would stand in for the listing's first page.
 *
 * Returns the list's state and a function that asks for it again.
 */
export function useList<T>(url: string, failure: string): [ListState<T>, () => void] {
    const [state, setState] = useState<ListState<T>>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState({ status: "loading" });

        const load = async (): Promise<ListState<T>> => {
            let response: Response;
            try {
                response = await apiFetch(url);
            } catch (unreachable) {
                return { status: "error", message: NETWORK_ERROR };
            }
            try {
                const body = response.ok ? await response.json() : null;
                if (Array.isArray(body?.items)) return { status: "ready", items: body.items as T[] };
            } catch (garbled) {
                // Not JSON: the same as any other answer that isn't the list.
            }
            return { status: "error", message: failure };
        };

        load().then((next) => {
            if (!cancelled) setState(next);
        });
        return () => {
            cancelled = true;
        };
    }, [url, failure, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return [state, retry];
}
