import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProfileButton from './ProfileButton';
import './Navigation.css';
import SearchBar from './searchBar';
import { RootState } from '../../types';

interface NavigationProps {
	isLoaded: boolean;
}

function Navigation({ isLoaded }: NavigationProps): React.JSX.Element {
	const sessionUser = useSelector((state: RootState) => state.session.user);

	return (
		<nav className='navBar-container'>
			<div className='navigationBar'>
				<div className='nav-left'>
					<div className='nav-logo'>
						<NavLink to="/">
							<img className="logo-img" src="https://i.imgur.com/c7KuGow.png" alt="Whelp Logo" />
						</NavLink>
					</div>
					<div className='nav-links'>
						<NavLink className='nav-link' exact to='/restaurants'>
							<i className="fas fa-utensils nav-icon"></i>
							<span>Restaurants</span>
						</NavLink>
					</div>
				</div>

				<div className='nav-center'>
					<SearchBar />
				</div>

				<div className='nav-right'>
					{(sessionUser === null) ? (
						<div className='auth-buttons'>
							<NavLink className='login-button' exact to='/login'>Log In</NavLink>
							<NavLink className='signup-button' exact to='/signup'>Sign Up</NavLink>
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
