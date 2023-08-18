import React, { useState } from "react";
import { login } from "../../store/session";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import './LoginForm.css';

function LoginFormPage() {
  const dispatch = useDispatch();
  const sessionUser = useSelector((state) => state.session.user);
  const [email_address, setEmail_Address] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState([]);

  if (sessionUser) return <Redirect to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await dispatch(login(email_address, password));
    if (data) {
      setErrors(data);
    }
  };

  return (
    <>
      <h1 className="logintext">Log In to Whelp</h1>
      <form onSubmit={handleSubmit}>
        <div className="errors">
          {errors.map((error, idx) => (
            <div className="login-error" key={idx}>{error}</div>
          ))}
        </div>
        <div className="autharea">
          <div className="authdeets">
              <input
                className="inputdeet"
                placeholder="Email"
                type="text"
                value={email_address}
                onChange={(e) => setEmail_Address(e.target.value)}
                required
              />
              <input
                className="inputdeet"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            <button type="submit" className="sibutton2" onClick={() => {dispatch(login('demo@aa.io', 'password'))}}>Log in as a Demo User</button>
            <button className="sibutton2" type="submit">Log In</button>
          </div>
          <div className="redcarpetpic">
            <img src="https://s3-media0.fl.yelpcdn.com/assets/2/www/img/7922e77f338d/signup/signup_illustration.png" alt=""></img>
          </div>
        </div>
      </form>

    </>
  );
}

export default LoginFormPage;
