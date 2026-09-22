import React, { useState, useEffect, useRef } from "react";
import { logout } from "../../store/session";
import OpenModalButton from "../OpenModalButton";
import LoginFormModal from "../LoginFormModal";
import SignupFormModal from "../SignupFormModal";
import CreateRestaurantModal from "../CreateRestaurantModal";
import { useHistory } from "react-router-dom";
import { useAppDispatch } from "../../store";
import { User } from "../../types";
import { onAvatarError } from "../../utils/images";

interface ProfileButtonProps {
  user: User | null;
}

function ProfileButton({ user }: ProfileButtonProps): React.JSX.Element {
  const dispatch = useAppDispatch();
  const history = useHistory();

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const ulRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setShowMenu(false);

  const toggleMenu = () => setShowMenu((open) => !open);

  useEffect(() => {
    if (!showMenu) return;

    const closeOnOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // The click that opened the menu can reach this listener: React 18
      // flushes this effect while that same click is still on its way up to
      // the document, so the listener is already attached by the time it
      // arrives. Ignoring clicks on the button itself is what makes the menu
      // stay open -- and it holds whenever the effect runs, rather than
      // relying on it running late. The button toggles, so a second click
      // still closes the menu.
      if (buttonRef.current?.contains(target)) return;
      if (ulRef.current && !ulRef.current.contains(target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", closeOnOutsideClick);

    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [showMenu]);

  const handleLogout = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dispatch(logout());
    history.push('/');
    closeMenu();
  };

  const loadProfile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (user) {
      history.push(`/users/get/${user.id}`);
    }
    closeMenu();
  };

  const ulClassName = "profile-dropdown" + (showMenu ? "" : " hidden");

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className='profileButton'
        aria-label="User menu"
        aria-expanded={showMenu}
      >
        {user && user.profile_image_url ? (
          <img className="profileButton-avatar" src={user.profile_image_url} alt="" onError={onAvatarError} />
        ) : (
          <i className="fa-solid fa-user"></i>
        )}
      </button>
      <ul className={ulClassName} ref={ulRef}>
        {user ? (
          <>
            <div className='user-dropdown-username'>{user.username}</div>
            <div className='user-dropdown-email'>{user.email}</div>
            <button className="user-profile-button" onClick={loadProfile}>
              <i className="fa-solid fa-user-circle"></i>
              My Profile
            </button>
            <div className="add-restaurant-dropdown-button">
              <OpenModalButton
                buttonText={
                  <>
                    <i className="fa-solid fa-plus"></i>
                    Add Restaurant
                  </>
                }
                onModalClose={closeMenu}
                modalComponent={<CreateRestaurantModal />}
              />
            </div>
            <button className='user-logout-button' onClick={handleLogout}>
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              Log Out
            </button>
          </>
        ) : (
          <>
            <OpenModalButton
              buttonText="Log In"
              onModalClose={closeMenu}
              modalComponent={<LoginFormModal />}
            />
            <OpenModalButton
              buttonText="Sign Up"
              onModalClose={closeMenu}
              modalComponent={<SignupFormModal />}
            />
          </>
        )}
      </ul>
    </>
  );
}

export default ProfileButton;
