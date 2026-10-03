/// <reference types="vite/client" />

import type { Store } from "redux";

declare global {
    interface Window {
        /** The store and the session actions, in development, for the console. */
        store?: Store;
        sessionActions?: unknown;
    }
}

// jest-axe's own module declaration is in jest-axe.d.ts: an ambient one has
// to live in a file with no imports. Its matcher, on Vitest's expect:
declare module "vitest" {
    interface Assertion<T = any> {
        toHaveNoViolations(): T;
    }
    interface AsymmetricMatchersContaining {
        toHaveNoViolations(): unknown;
    }
}
