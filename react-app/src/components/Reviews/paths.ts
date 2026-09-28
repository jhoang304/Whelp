/**
 * The review pages' routes, shared by App and the tests that render them.
 *
 * Ids only: a bare "/:restaurantId" first segment matched any path shaped
 * like these, so "/foo/create-review" opened a form for a restaurant called
 * "foo" (#112).
 */
export const CREATE_REVIEW_PATH = "/:restaurantId(\\d+)/create-review";
export const UPDATE_REVIEW_PATH = "/:restaurantId(\\d+)/reviews/:reviewId(\\d+)/update";
