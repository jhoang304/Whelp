import { parseErrors } from "../utils/parseErrors";

// constants
const SET_USER = "session/SET_USER";
const REMOVE_USER = "session/REMOVE_USER";

export const setUser = (user: any) => ({
	type: SET_USER,
	payload: user,
});

const removeUser = () => ({
	type: REMOVE_USER,
});

const initialState = { user: null };

export const authenticate = () => async (dispatch: any) => {
	const response = await fetch("/api/auth/", {
		headers: {
			"Content-Type": "application/json",
		},
	});
	if (response.ok) {
		dispatch(setUser(await response.json()));
	}
};

export const login = (email: any, password: any) => async (dispatch: any) => {
	const response = await fetch("/api/auth/login", {
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

export const logout = () => async (dispatch: any) => {
	const response = await fetch("/api/auth/logout", {
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (response.ok) {
		dispatch(removeUser());
	}
};


export const signUp = (username: any, email: any, first_name: any, last_name: any, password: any) => async (dispatch: any) => {
	const response = await fetch("/api/auth/signup", {
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

export default function reducer(state: any = initialState, action: any) {
	switch (action.type) {
		case SET_USER:
			return { user: action.payload };
		case REMOVE_USER:
			return { user: null };
		default:
			return state;
	}
}
