import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import ProfileButton from './ProfileButton';
import './Navigation.css';
import SearchBar from './searchBar';
import { useAppSelector } from "../../store";
import { authLink } from "../../utils/returnTo";

function Navigation(): React.JSX.Element {
	const sessionUser = useAppSelector((state) => state.session.user);
	// So logging in from a restaurant comes back to it (#135).
	const location = useLocation();

	return (
		<nav className='navBar-container'>
			<div className='navigationBar'>
				<div className='nav-left'>
					<div className='nav-logo'>
						<NavLink to="/">
							<img className="logo-img" src="/whelp-logo.png" alt="Whelp" />
						</NavLink>
					</div>
				</div>

				<div className='nav-center'>
					<SearchBar />
				</div>

				<div className='nav-right'>
					{(sessionUser === null) ? (
						<div className='auth-buttons'>
							<NavLink className='login-button' exact to={authLink('/login', location)}>Log In</NavLink>
							<NavLink className='signup-button' exact to={authLink('/signup', location)}>Sign Up</NavLink>
						</div>
					) : (
						<div className='user-profile'>
							<ProfileButton user={sessionUser} />
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}

export default Navigation;
