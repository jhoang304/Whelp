import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import { GoogleOutcome, GoogleStatus, fetchGoogleStatus, googleOutcome } from "../utils/google";

/** Whether Google sign-in is offered, and confirmed: null until the server says. */
export function useGoogleStatus(): GoogleStatus | null {
    const [status, setStatus] = useState<GoogleStatus | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetchGoogleStatus().then((answer) => {
            if (!cancelled) setStatus(answer);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return status;
}

/**
 * What the ?google= this page arrived with says happened. Read once, then
 * taken out of the address, so a reload or a bookmark doesn't say it again.
 */
export function useGoogleOutcome(): GoogleOutcome {
    const location = useLocation();
    const history = useHistory();
    const [outcome] = useState(() => googleOutcome(location.search));
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (!params.has("google")) return;
        params.delete("google");
        const rest = params.toString();
        history.replace({ ...location, search: rest ? `?${rest}` : "" });
    }, [history, location]);
    return outcome;
}
