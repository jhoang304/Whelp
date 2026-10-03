/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The build, the dev server and the tests, in one place (#138). Create React
 * App did all three until it was deprecated and stopped being maintained,
 * which left the audit unfixable and TypeScript stuck at 4.
 */
export default defineConfig({
    plugins: [react()],
    server: {
        // Where CRA's dev server was, so nothing that points at it moves.
        port: 3000,
        // The Flask API, which `flask run` serves on 5000. Everything the app
        // asks the server for is under /api; CRA's "proxy" field did this.
        proxy: { "/api": "http://localhost:5000" },
    },
    build: {
        // Where Flask serves the app from (static_folder='../react-app/build'),
        // so neither it nor Render's build command changes.
        outDir: "build",
        emptyOutDir: true,
        rollupOptions: {
            treeshake: {
                // The store only uses redux-logger in development, and a
                // production build drops that branch -- but Rollup keeps an
                // import it can't prove harmless, and the logger shipped
                // anyway. Importing it does nothing by itself, so say so.
                moduleSideEffects: (id) => !/[\\/]node_modules[\\/]redux-logger[\\/]/.test(id),
            },
        },
    },
    test: {
        // describe/test/expect without importing them, as under Jest; `vi`
        // stands in for `jest`.
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        // CRA's Jest reset every mock between tests; the suite was written
        // against that.
        mockReset: true,
    },
});
