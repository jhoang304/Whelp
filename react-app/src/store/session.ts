import { AnyAction } from "redux";

import { SessionState, User } from "../types";
import { AppDispatch } from "./index";
import { parseErrors } from "../utils/parseErrors";
import { apiFetch } from "../utils/api";

// constants
const SET_USER = "session/SET_USER";
const REMOVE_USER = "session/REMOVE_USER";

export const setUser = (user: User) => ({
	type: SET_USER,
	payload: user,
});

export const removeUser = () => ({
	type: REMOVE_USER,
});

const initialState = { user: null };

/**
 * Who is signed in, if anyone. Never rejects: the app waits on this before
 * drawing any page, and a dropped connection here used to leave the nav bar
 * over an empty page for good (#116). Unreachable, or unreadable, reads as
 * signed out.
 */
export const authenticate = () => async (dispatch: AppDispatch) => {
	try {
		const response = await apiFetch("/api/auth/", {
			headers: {
				"Content-Type": "application/json",
			},
		});
		if (response.ok) {
			// The user, or {"user": null} when nobody is signed in: being
			// signed out is an answer, not a 401 (#126). Taken as a user, that
			// body would have looked like somebody signed in.
			const body = await response.json();
			if (body && body.user !== null) dispatch(setUser(body));
		}
	} catch (unreachable) {
		// Offline, or an answer that won't parse: signed out, as far as the
		// app can tell.
	}
};

export const login = (email: string, password: string) => async (dispatch: AppDispatch) => {
	const response = await apiFetch("/api/auth/login", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email,
			password,
		}),
	});

	if (response.ok) {
		const data = await response.json();
		dispatch(setUser(data));
		return null;
	}
	return parseErrors(response, "An error occurred. Please try again.");
};

export const logout = () => async (dispatch: AppDispatch) => {
	const response = await apiFetch("/api/auth/logout", {
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (response.ok) {
		dispatch(removeUser());
	}
};


export const signUp = (username: string, email: string, first_name: string, last_name: string, password: string) => async (dispatch: AppDispatch) => {
	const response = await apiFetch("/api/auth/signup", {
	  method: "POST",
	  headers: {
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({
		username,
		email,
		first_name,
		last_name,
		password,
	  }),
	});

	if (response.ok) {
	  const data = await response.json();
	  dispatch(setUser(data));
	  return null;
	}
	return parseErrors(response, "An error occurred. Please try again.");
  };

export default function reducer(state: SessionState = initialState, action: AnyAction): SessionState {
	switch (action.type) {
		case SET_USER:
			return { user: action.payload };
		case REMOVE_USER:
			return { user: null };
		default:
			return state;
	}
}
