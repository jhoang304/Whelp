import React, { useState } from "react";
import { login } from "../../store/session";
import { Link, Redirect, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store";
import FormErrors from "../FormErrors";
import { pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";
import { authLink, returnPath } from "../../utils/returnTo";
import './LoginForm.css';

const ERRORS_ID = "login-errors";

function LoginFormPage(): React.JSX.Element {
  // --- Hooks must be called first ---
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector((state) => state.session.user);
  const location = useLocation();
  const [email_address, setEmail_Address] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  // Every error, in the form, until the next try (#122). They were a toast
  // of the first one only, gone after four seconds, over the nav bar on a
  // tablet, and never read out.
  const [errors, setErrors] = useState<string[]>([]);
  useDocumentTitle(pageTitle("Log in"));
  // The login refused is the pair, not either field: both are marked, and
  // both point at the message.
  const invalid = errors.length > 0;
  const fieldErrorProps = invalid ? { "aria-invalid": true, "aria-describedby": ERRORS_ID } : {};

  // --- Early return can happen AFTER hooks ---
  // Signed in -- just now, or already -- goes back to the page the link was
  // followed from, rather than home (#135). A Redirect replaces this entry,
  // so Back doesn't return to a login form for someone logged in.
  if (sessionUser) return <Redirect to={returnPath(location.state)} />;
  // ------------------------------------------

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = await dispatch(login(email_address, password));
    if (data) {
      setErrors(data);
    } else {
      setErrors([]); // Clear errors on successful login
    }
  };

  const handleDemoLogin = () => {
    dispatch(login('demo@aa.io', 'password')).then((data: string[] | null) => {
      if (data) {
        setErrors(data);
      } else {
        setErrors([]);
      }
    });
  };

  // --- Component Render ---
  return (
    <div className="login-page-container">
      <div className="login-form-container">
        <div className="login-image-section">
          <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80" alt="Restaurant food" />
        </div>
        <div className="login-form-section">
          <h1 className="login-title">Log In to Whelp</h1>
          <p className="login-subtitle">Access your account</p>
          <form onSubmit={handleSubmit} className="login-form">
            <FormErrors errors={errors} id={ERRORS_ID} className="login-errors" />
            <div className="login-field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                className="login-input"
                placeholder="Enter your email"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                spellCheck={false}
                value={email_address}
                onChange={(e) => setEmail_Address(e.target.value)}
                required
                {...fieldErrorProps}
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="login-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                {...fieldErrorProps}
              />
            </div>
            <button className="login-submit-button" type="submit">Log In</button>
            <button type="button" className="demo-login-button" onClick={handleDemoLogin}>
              Log in as Demo User
            </button>
          </form>
          <p className="signup-link">
            Don't have an account?  <Link to={authLink("/signup", location)}>Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginFormPage;
