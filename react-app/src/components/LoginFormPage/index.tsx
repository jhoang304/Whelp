import React, { useState, useEffect } from "react";
import { login } from "../../store/session";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import { RootState } from "../../types";
import { AppDispatch } from "../../store";
import './LoginForm.css';

function LoginFormPage(): React.JSX.Element {
  // --- Hooks must be called first ---
  const dispatch = useDispatch<AppDispatch>();
  const sessionUser = useSelector((state: RootState) => state.session.user);
  const [email_address, setEmail_Address] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  useEffect(() => {
    if (errors.length > 0) {
      setToastMessage(errors[0]); // Show the first error
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000); // Hide after 4 seconds
      return () => clearTimeout(timer); // Cleanup timer on unmount or error change
    } else {
      setShowToast(false);
      return undefined;
    }
  }, [errors]);
  // ----------------------------------

  // --- Early return can happen AFTER hooks ---
  if (sessionUser) return <Redirect to="/" />;
  // ------------------------------------------

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = await dispatch(login(email_address, password) as any);
    if (data) {
      setErrors(data);
    } else {
      setErrors([]); // Clear errors on successful login
    }
  };

  const handleDemoLogin = () => {
    dispatch(login('demo@aa.io', 'password') as any).then((data: string[] | null) => {
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
      {/* --- Toast Notification --- */}
      {showToast && (
        <div className="toast-notification show">
          {toastMessage}
        </div>
      )}
      {/* ------------------------ */}
      <div className="login-form-container">
        <div className="login-image-section">
          <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80" alt="Restaurant food" />
        </div>
        <div className="login-form-section">
          <h1 className="login-title">Log In to Whelp</h1>
          <p className="login-subtitle">Access your account</p>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                className="login-input"
                placeholder="Enter your email"
                type="text"
                value={email_address}
                onChange={(e) => setEmail_Address(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="login-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="login-submit-button" type="submit">Log In</button>
            <button type="button" className="demo-login-button" onClick={handleDemoLogin}>
              Log in as Demo User
            </button>
          </form>
          <p className="signup-link">
            Don't have an account?  <a href="/signup">Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginFormPage;
