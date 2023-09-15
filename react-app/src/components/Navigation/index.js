import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProfileButton from './ProfileButton';
import './Navigation.css';
import SearchBar from './searchBar';


function Navigation() {
	const sessionUser = useSelector(state => state.session.user);


	return (
		<nav className='navBar-container'>
			<div className='navigationBar'>
				<div className='nav-logo'>
					<div><NavLink to="/"><img className="logo-img" src="https://cdn.discordapp.com/attachments/320286625521336341/1141155662915698808/Whelp_logo.png" alt="logo"></img></NavLink></div>
					{/* <div><NavLink to="/">Logo</NavLink></div> */}
				</div>
				<SearchBar />
				{(sessionUser === null) ?
					<div className='navBar-right'>
						<div className='signup-button-div'>
							<NavLink className='signup-button' exact to='/signup'>Sign Up</NavLink>
						</div>
						<div className='login-button-div'>
							<NavLink className='login-button' exact to='/login'>Log In</NavLink>
						</div>
					</div>
					:
					<div className='navBar-right'>
						<div className='user-profile'>
							<ProfileButton user={sessionUser} />
						</div>
					</div>
				}
			</div>
		</nav>
	);
}

export default Navigation;
