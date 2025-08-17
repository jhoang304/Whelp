// constants
const SET_USER = "session/SET_USER";
const REMOVE_USER = "session/REMOVE_USER";

const setUser = (user: any) => ({
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
		const data = await response.json();
		if (data.errors) {
			return;
		}

		dispatch(setUser(data));
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
	} else if (response.status < 500) {
		const data = await response.json();
		if (data.errors) {
			return data.errors;
		}
	} else {
		return ["An error occurred. Please try again."];
	}
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
	} else if (response.status < 500) {
	  const data = await response.json();
	  if (data.errors) {
		const fieldErrorMap = {
		  username: "Username",
		  email: "Email",
		  first_name: "First Name",
		  last_name: "Last Name"
		};

		const formattedErrors = data.errors.map((error: any) => {
		  const [fieldName, errorMessage] = error.split(" : ");
		  const formattedFieldName = (fieldErrorMap as any)[fieldName] || fieldName;
		  return `${formattedFieldName} ${errorMessage.replace("Field ", "")}`;
		});

		return formattedErrors;
	  }
	} else {
	  return ["An error occurred. Please try again."];
	}
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
