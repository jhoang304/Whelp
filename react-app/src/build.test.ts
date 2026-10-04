// @vitest-environment node
// Vite's own config, loaded as Vite loads it: in Node, not the page's jsdom,
// where esbuild refuses to start.
import config from "../vite.config";

/**
 * What the rest of the project counts on Vite's settings for (#138): Flask
 * and Render read the build from react-app/build, the dev server hands /api
 * to Flask, and the logger that only development uses stays out of the
 * production bundle.
 */

test("the build goes where Flask serves it from", () => {
  // app/__init__.py: static_folder='../react-app/build'
  expect(config.build?.outDir).toBe("build");
});

test("the dev server sends the API on to Flask, where CRA's proxy field did", () => {
  expect(config.server?.proxy).toEqual({ "/api": "http://localhost:5000" });
  expect(config.server?.port).toBe(3000);
});

test("redux-logger is marked harmless to drop, so production doesn't ship it", () => {
  const treeshake = config.build?.rollupOptions?.treeshake;
  const moduleSideEffects = typeof treeshake === "object" ? treeshake.moduleSideEffects : undefined;
  expect(typeof moduleSideEffects).toBe("function");
  const sideEffects = moduleSideEffects as (id: string, external: boolean) => boolean;
  expect(sideEffects("/app/node_modules/redux-logger/dist/redux-logger.js", false)).toBe(false);
  expect(sideEffects("C:\\app\\node_modules\\redux-logger\\dist\\redux-logger.js", false)).toBe(false);
  // Everything else keeps what it declares.
  expect(sideEffects("/app/node_modules/react-dom/index.js", false)).toBe(true);
  expect(sideEffects("/app/src/index.css", false)).toBe(true);
});

test("the tests run as they did under Create React App: in jsdom, with mocks reset between tests", () => {
  expect(config.test?.environment).toBe("jsdom");
  expect(config.test?.globals).toBe(true);
  expect(config.test?.mockReset).toBe(true);
});
