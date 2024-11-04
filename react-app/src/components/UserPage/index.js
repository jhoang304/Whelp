import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useHistory, NavLink } from "react-router-dom";
import { getProfileThunk, editProfileThunk } from "../../store/userProfile";
import OpenModalButton from "../OpenModalButton";
import "./UserProfilePage.css"
import starpic from './star.png'
import UpdateProfile from "./UpdateProfile";

export default function UserProfilePage() {
    const dispatch = useDispatch()
    const [showMenu, setShowMenu] = useState(false);
    const ulRef = useRef();

    useEffect(() => {
        if (!showMenu) return;

        const closeMenu = (e) => {
            if (!ulRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener("click", closeMenu);

        return () => document.removeEventListener("click", closeMenu);
    }, [showMenu]);

    const sessionUser = useSelector(state => {
        return state.session.user
    })
    const { userId } = useParams()

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        dispatch(getProfileThunk(userId)).then(() => {
            return setIsLoaded(true)
        });
    }, [dispatch]);


    let reviews = []

    let user = useSelector((state) => state.user)

    if (isLoaded) {
        let userTotalReviews = user.user.reviews
        reviews = Object.values(userTotalReviews);
    }

    const ratings = (num) => {
        if (num === 5) {
            return (<div><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /></div>)
        } else if (num === 4) {
            return (<div><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /></div>)
        } else if (num === 3) {
            return (<div><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /></div>)
        } else if (num === 2) {
            return (<div><img className="yelpstar" src={starpic} alt="" /><img className="yelpstar" src={starpic} alt="" /></div>)
        } else if (num === 1) {
            return (<div><img className="yelpstar" src={starpic} alt="" /></div>)
        }
    }


    return (
        isLoaded && (
            <div className="mainlayer">
                <div className="deetscontainer">
                    <div className="topmost">
                        <div className="userinfo">
                            <div className="portrait-and-info">
                                <img className="user-portrait" src="https://i.imgur.com/eiUEyDW.png" alt="" />
                                <div className="stats">
                                    <div id="name">
                                        {user.user.username}
                                    </div>
                                    <div id="reviews">
                                        {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                                    </div>
                                </div>
                            </div>
                            {sessionUser && user.user.id == sessionUser.id ?
                                <div className="update-userprofile">
                                    <OpenModalButton
                                        buttonText="Update Your Profile"
                                        className="update-profile-button"
                                        modalComponent={<UpdateProfile user={user.user} />}
                                    /></div> : ""}
                        </div>
                    </div>
                </div>
                <div>
                    <div class="horizontalline">
                        <div className="midpart">Reviews</div>
                    </div>
                    {reviews.map(rev => (
                        <div className="width" key={rev.id}>
                            <div className="reviewscontainer">
                                <NavLink to={`/single/${rev.restaurant_id}`}>
                                    <p className="restaurantname">{rev.restaurant.name}</p>
                                </NavLink>
                                <div className="amountstars">Rating:  {ratings(parseInt(rev.rating))}</div>
                                <p className="showit">Review:</p><div>{rev.review}</div>
                                <div><hr className="inbetween"></hr></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))
}
