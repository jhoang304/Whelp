import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useHistory, NavLink } from "react-router-dom";
import { AppDispatch, RootState } from "../../store";
import { getProfileThunk, editProfileThunk } from "../../store/userProfile";
import OpenModalButton from "../OpenModalButton";
import "./UserProfilePage.css"
import starpic from './star.png'
import UpdateProfile from "./UpdateProfile";

export default function UserProfilePage() {
    const dispatch = useDispatch<AppDispatch>()
    const [showMenu, setShowMenu] = useState(false);
    const ulRef = useRef<HTMLUListElement>(null);

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

    const sessionUser = useSelector((state: RootState) => {
        return state.session.user
    })
    const { userId } = useParams<{ userId: string }>()

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        dispatch(getProfileThunk(userId) as any).then(() => {
            return setIsLoaded(true)
        });
    }, [dispatch, userId]);


    let reviews: any[] = []

    let user = useSelector((state: RootState) => state.user)

    if (isLoaded) {
        let userTotalReviews = user.user.reviews
        reviews = Object.values(userTotalReviews);
    }

    const ratings = (num: number) => {
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
        } else {
            return <div></div>
        }
    }


    if (!isLoaded) {
        return null;
    }

    return (
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
                <div className="horizontalline">
                    <div className="midpart">Reviews</div>
                </div>
                {reviews.map((rev: any) => (
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
    )
}
