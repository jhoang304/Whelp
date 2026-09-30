import React, { useState, useEffect, useRef } from "react";
import { logout } from "../../store/session";
import OpenModalButton from "../OpenModalButton";
import LoginFormModal from "../LoginFormModal";
import SignupFormModal from "../SignupFormModal";
import CreateRestaurantModal from "../CreateRestaurantModal";
import { Link, useHistory } from "react-router-dom";
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

    // Escape shuts it from anywhere, and hands focus back to the button so
    // a keyboard user is not left on an item that has just disappeared.
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setShowMenu(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showMenu]);

  // A modal opened from the menu closes it, and the item that opened the
  // modal goes with it -- so focus comes back to the button instead, which
  // is still there to take it.
  const closeMenuAfterModal = () => {
    closeMenu();
    buttonRef.current?.focus();
  };

  const handleLogout = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dispatch(logout());
    history.push('/');
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
          <i className="fa-solid fa-user" aria-hidden="true"></i>
        )}
      </button>
      <ul className={ulClassName} ref={ulRef}>
        {user ? (
          <>
            <li className='user-dropdown-username'>{user.username}</li>
            <li className='user-dropdown-email'>{user.email}</li>
            {/* Links: they go to a page, so they open in a new tab like any
                other (#122). */}
            <li>
              <Link className="user-profile-button" to={`/users/get/${user.id}`} onClick={closeMenu}>
                <i className="fa-solid fa-user-circle" aria-hidden="true"></i>
                My Profile
              </Link>
            </li>
            <li>
              <Link className="user-profile-button" to="/settings" onClick={closeMenu}>
                <i className="fa-solid fa-gear" aria-hidden="true"></i>
                Account settings
              </Link>
            </li>
            <li className="add-restaurant-dropdown-button">
              <OpenModalButton
                buttonText={
                  <>
                    <i className="fa-solid fa-plus" aria-hidden="true"></i>
                    Add Restaurant
                  </>
                }
                onModalClose={closeMenuAfterModal}
                modalComponent={<CreateRestaurantModal />}
              />
            </li>
            <li>
              <button className='user-logout-button' onClick={handleLogout}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                Log Out
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <OpenModalButton
                buttonText="Log In"
                onModalClose={closeMenuAfterModal}
                modalComponent={<LoginFormModal />}
              />
            </li>
            <li>
              <OpenModalButton
                buttonText="Sign Up"
                onModalClose={closeMenuAfterModal}
                modalComponent={<SignupFormModal />}
              />
            </li>
          </>
        )}
      </ul>
    </>
  );
}

export default ProfileButton;
