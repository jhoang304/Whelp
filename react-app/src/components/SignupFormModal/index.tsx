import React, { useState } from "react";
import { useModal } from "../../context/Modal";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "../../utils/password";
import { signUp } from "../../store/session";
import { useAppDispatch } from "../../store";
import "./SignupForm.css";

function SignupFormModal(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const [email, setEmail] = useState<string>("");
	const [username, setUsername] = useState<string>("");
	const [first_name, setFirst_Name] = useState<string>("");
  	const [last_name, setLast_Name] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [confirmPassword, setConfirmPassword] = useState<string>("");
	const [errors, setErrors] = useState<string[]>([]);
	const { closeModal } = useModal();

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (password.length < PASSWORD_MIN_LENGTH) {
			setErrors([PASSWORD_TOO_SHORT]);
		} else if (password === confirmPassword) {
			const failures = await dispatch(signUp(username, email, first_name, last_name, password));
			if (failures) {
				setErrors(failures);
			} else {
				closeModal();
			}
		} else {
			setErrors([
				"Confirm Password field must be the same as the Password field",
			]);
		}
	};

	return (
		<>
			<h1>Sign Up</h1>
			<form onSubmit={handleSubmit}>
				<ul>
					{errors.map((error, idx) => (
						<li key={idx}>{error}</li>
					))}
				</ul>
				<label>
					Email
					<input
						type="text"
						value={email}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
						required
					/>
				</label>
				<label>
					Username
					<input
						type="text"
						value={username}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
						required
					/>
				</label>
				<label>
					First Name
					<input
						type="text"
						value={first_name}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirst_Name(e.target.value)}
						required
					/>
				</label>
				<label>
					Last Name
					<input
						type="text"
						value={last_name}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLast_Name(e.target.value)}
						required
					/>
				</label>
				<label>
					Password
					<input
						type="password"
						value={password}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
						required
					/>
				</label>
				<label>
					Confirm Password
					<input
						type="password"
						value={confirmPassword}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
						required
					/>
				</label>
				<button type="submit">Sign Up</button>
			</form>
		</>
	);
}

export default SignupFormModal;
