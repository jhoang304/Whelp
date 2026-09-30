import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import session, { authenticate } from "./session";

/**
 * Who is signed in, as the API answers it: their user, or {"user": null}
 * with a 200 when nobody is (#126). It used to be a 401 for every signed-out
 * visitor.
 */

function answer(body: unknown) {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(body),
  }));
  const store = createStore(combineReducers({ session }), applyMiddleware(thunk));
  return store;
}

afterEach(() => {
  delete (global as any).fetch;
});

test("nobody signed in is signed out, not a user called nothing", async () => {
  const store = answer({ user: null });
  await store.dispatch(authenticate() as any);
  expect(store.getState().session.user).toBeNull();
});

test("somebody signed in is that user", async () => {
  const user = { id: 1, username: "Demo", email: "demo@aa.io" };
  const store = answer(user);
  await store.dispatch(authenticate() as any);
  expect(store.getState().session.user).toEqual(user);
});
