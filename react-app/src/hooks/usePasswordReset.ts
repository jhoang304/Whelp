import { useEffect, useState } from "react";

import { fetchResetAvailable } from "../store/passwordReset";

/** Whether a forgotten password can be reset by email here: false until the server says so. */
export function usePasswordResetAvailable(): boolean {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        let cancelled = false;
        fetchResetAvailable().then((answer) => {
            if (!cancelled) setAvailable(answer);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return available;
}
