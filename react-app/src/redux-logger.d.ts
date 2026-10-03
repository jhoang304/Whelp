/**
 * redux-logger has no types of its own, and @types/redux-logger is written
 * against Redux 5 -- and installs it -- where this app is on Redux 4 (#138).
 * The default export, a middleware, is all the store uses. No imports at the
 * top: an ambient module declaration has to sit in a file that isn't a
 * module itself.
 */
declare module "redux-logger" {
    const logger: import("redux").Middleware;
    export default logger;
}
