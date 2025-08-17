import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import { signUp } from "../../store/session";
import { RootState } from "../../types";
import { AppDispatch } from "../../store";
import './SignupForm.css';

function SignupFormPage(): React.JSX.Element {
  const dispatch = useDispatch<AppDispatch>();
  const sessionUser = useSelector((state: RootState) => state.session.user);
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [first_name, setFirst_Name] = useState<string>("");
  const [last_name, setLast_Name] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  if (sessionUser) return <Redirect to="/" />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password === confirmPassword) {
      const data = await dispatch(signUp(username, email, first_name, last_name, password) as any);
      if (data) {
        setErrors(data);
      } else {
        setErrors([]); // Clear errors on success
      }
    } else {
      setErrors([
        "Confirm Password field must be the same as the Password field",
      ]);
    }
  };

  return (
    <div className="signup-page-container">
      <div className="signup-form-container">
        <div className="signup-form-section">
          <h1 className="signup-title">Create Your Account</h1>
          <p className="signup-subtitle">Join the Whelp community</p>
          <form onSubmit={handleSubmit} className="signup-form">
            {errors.length > 0 && (
              <div className="signup-errors-container">
                {errors.map((error, idx) => (
                  <div className="signup-error-message" key={idx}>{error}</div>
                ))}
              </div>
            )}
            <div className="name-inputs">
              <div className="input-group">
                <label htmlFor="first_name">First Name</label>
                <input
                  id="first_name"
                  className="signup-input"
                  type="text"
                  value={first_name}
                  onChange={(e) => setFirst_Name(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="last_name">Last Name</label>
                <input
                  id="last_name"
                  className="signup-input"
                  type="text"
                  value={last_name}
                  onChange={(e) => setLast_Name(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                className="signup-input"
                type="email" // Changed to type email
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="signup-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="signup-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className="signup-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button className="signup-submit-button" type="submit">Sign Up</button>
          </form>
          <p className="login-link">
            Already have an account? <a href="/login">Log In</a>
          </p>
        </div>
        <div className="signup-image-section">
          <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80" alt="Restaurant interior" />
        </div>
      </div>
    </div>
  );
};

export default SignupFormPage;
