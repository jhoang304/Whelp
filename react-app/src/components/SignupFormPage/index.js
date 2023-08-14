import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Redirect } from "react-router-dom";
import { signUp } from "../../store/session";
import './SignupForm.css';

function SignupFormPage() {
  const dispatch = useDispatch();
  const sessionUser = useSelector((state) => state.session.user);
  const [email_address, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [first_name, setFirst_Name] = useState("");
  const [last_name, setLast_Name] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState([]);

  const uponSignUp = async (e) => {
    const regex = new RegExp('.+@.+\\..+')
		const isvalidEmail = regex.test(email_address)
    e.preventDefault();
    if (password === confirmPassword){
      if(!isvalidEmail){
        setErrors(["Please enter a valid email address"])
      }else if (username.length < 4 || username.length > 60){
				setErrors(["Username must be between 4 and 60 characters"])
      }else if(first_name.length < 1 || first_name.length > 50){
        setErrors(["First name must be between 1 and 50 characters long"])
      }else if(last_name.length < 1 || last_name.length > 50){
        setErrors(["Last name must be between 1 and 50 characters long"])
      }else {
        const data = await dispatch(signUp(email_address, username, first_name, last_name, password));
        if(data){
          setErrors(data)
        }
      }
    }else{
      setErrors(["Confirm Password field must be the same as the Password field"])
    }
  }

  if (sessionUser) return <Redirect to="/" />;


  return (
    <>
      <h1 className="signuptext">Sign Up</h1>
      <form onSubmit={uponSignUp}>
        <div className="errors">
          {errors.map((error, idx) => (
            <div className="error" key={idx}>{error}</div>))}
        </div>
        <div className="autharea">
          <div className="authdeets-signup">
            <div className="autharea-items">
              <span>First Name</span>
              <input
                className="inputdeet"
                type="text"
                name="first_name"
                value={first_name}
                onChange={(e) => setFirst_Name(e.target.value)}
                required
              />
            </div>

            <div className="autharea-items">
              <span>Last Name</span>
              <input
                className="inputdeet"
                type="text"
                name="last_name"
                value={last_name}
                onChange={(e) => setLast_Name(e.target.value)}
                required
              />
            </div>
            <div className="autharea-items">
              <span>Email Address</span>
              <input
                className="inputdeet"
                type="text"
                name="email_address"
                value={email_address}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="autharea-items">
              <span>Username</span>
              <input
                className="inputdeet"
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="autharea-items">
              <span>Password</span>
              <input
                className="inputdeet"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="autharea-items">
              <span>Confirm Password</span>
              <input
                className="inputdeet"
                type="password"
                name="confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button className="sibutton" type="submit">Sign Up</button>
          </div>
          <div className="redcarpetpic">
            <img src="https://s3-media0.fl.yelpcdn.com/assets/2/www/img/7922e77f338d/signup/signup_illustration.png"></img>
          </div>
        </div>
      </form>
    </>
  );
};

export default SignupFormPage;
