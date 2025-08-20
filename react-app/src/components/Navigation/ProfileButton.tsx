import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { logout } from "../../store/session";
import OpenModalButton from "../OpenModalButton";
import LoginFormModal from "../LoginFormModal";
import SignupFormModal from "../SignupFormModal";
import CreateRestaurantModal from "../CreateRestaurantModal";
import { useHistory } from "react-router-dom";
import { AppDispatch } from "../../store";
import { User } from "../../types";

interface ProfileButtonProps {
  user: User | null;
}

function ProfileButton({ user }: ProfileButtonProps): React.JSX.Element {
  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const ulRef = useRef<HTMLUListElement>(null);

  const openMenu = () => {
    if (showMenu) return;
    setShowMenu(true);
  };

  useEffect(() => {
    if (!showMenu) return;

    const closeMenu = (e: MouseEvent) => {
      if (ulRef.current && !ulRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", closeMenu);

    return () => document.removeEventListener("click", closeMenu);
  }, [showMenu]);

  const handleLogout = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dispatch(logout() as any);
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
  const closeMenu = () => setShowMenu(false);

  return (
    <>
      <button onClick={openMenu} className='profileButton' aria-label="User menu">
        <i className="fa-solid fa-user"></i>
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
