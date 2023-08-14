import "./SingleRestaurant.css"
import { useEffect } from "react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { useParams } from 'react-router-dom';
import { getSingleRestaurant } from "../../store/restaurants"
import AddPhotoModal from "../AddPhotoModal";
import OpenModalButton from "../OpenModalButton";
import EditRestaurant from "../EditRestaurantModal";
import DeleteRestaurant from "../DeleteRestaurant";
import GetAllReviews from "../Reviews/GetAllReviews";
import RatingStar from "../RatingStar";
import DisplayPhotos from "../DisplayPhotos";


function getMap(str) {
    return str.replaceAll(" ", "+")
}

function SingleRestaurant() {


    const history = useHistory();
    const { restaurantId } = useParams()

    const singleRestaurant = useSelector((state) => {
        return state.Restaurants.singleRestaurant
    })

    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(getSingleRestaurant(+restaurantId)).then(() => setIsLoaded(true));
    }, [dispatch, restaurantId])


    const [isLoaded, setIsLoaded] = useState(false);
    const [showDeleteEdit, setShowDeleteEdit] = useState(false)

    const sessionUser = useSelector(state => state.session.user);

    const takeoutIcon = (<svg width="24" height="24" class="icon_svg"><path d="M22 7h-5.177l-1.16-4.33a1 1 0 10-1.931.518L14.752 7H9.228l1.021-3.812a1.002 1.002 0 00-1.096-1.254 1 1 0 00-.836.737L7.157 7H2a1 1 0 00-1 1v4a1 1 0 001 1h.88l1.318 6.588A3.006 3.006 0 007.14 22h9.72a3.006 3.006 0 002.942-2.411L21.12 13H22a1 1 0 001-1V8a.998.998 0 00-1-1zm-4.16 12.197a1.001 1.001 0 01-.98.803H7.14a1.001 1.001 0 01-.98-.804L4.92 13h14.16l-1.24 6.197zM21 11H3V9h3.621l-.056.209a1 1 0 101.932.518L8.692 9h6.596l.215.8a1 1 0 001.932-.517L17.359 9H21v2z"></path></svg>)
    const deliveryIcon = (<svg width="24" height="24" class="icon_svg"><path d="M23.596 17a4.97 4.97 0 00-1.836-3.839L17.753 4.77a1.114 1.114 0 00-.464-.53.983.983 0 00-.432-.124c-.013 0-.023-.008-.036-.008h-4.843a1 1 0 000 2h1.656a3.534 3.534 0 00-.09 3.006l1.817 4.107A5.018 5.018 0 0013.703 16H9.748a2.537 2.537 0 01-1.488-2.107c0-1.486 1.971-1.895 2.05-1.91a1 1 0 00.815-.983V9a.998.998 0 00-1-1h-2.03V5a3.003 3.003 0 00-3-3H1.38a1 1 0 00-1 1v8a1 1 0 001 1h.28a6.56 6.56 0 00-1.115 5.203.99.99 0 00.807.77c0 .01-.005.017-.005.027a4.056 4.056 0 108.11 0h5.06a4.055 4.055 0 108.109 0l-.001-.006a.996.996 0 00.97-.994zM9.125 10v.249a3.987 3.987 0 00-2.865 3.644A3.909 3.909 0 006.86 16H2.405a4.571 4.571 0 011.621-3.646 1 1 0 00-.079-1.587L2.832 10h6.293zM2.38 4h2.715a1 1 0 011 1v3H2.832c-.153.007-.305.03-.452.072V4zM5.4 20.056A2.058 2.058 0 013.347 18h4.11a2.058 2.058 0 01-2.056 2.056zM21.425 16h-5.658a3.001 3.001 0 015.658 0zm-5.93-9.182c.175-.273.431-.484.732-.603l2.783 5.827c-.14-.012-.272-.042-.414-.042-.502.007-1 .09-1.477.248l-1.744-3.943a1.54 1.54 0 01.12-1.487zm3.076 13.238A2.058 2.058 0 0116.517 18h4.109a2.058 2.058 0 01-2.055 2.056z"></path></svg>)
    const reservationIcon = (<svg width="24" height="24" class="icon_svg"><path d="M22 3a1 1 0 011 1v16a3 3 0 01-3 3H4a3 3 0 01-3-3V4a1 1 0 011-1h4.5V2a1 1 0 012 0v1h7V2a1 1 0 012 0v1H22zM6.5 5H3v4h18V5h-3.5v1a1 1 0 11-2 0V5h-7v1a1 1 0 11-2 0V5zM20 21a1 1 0 001-1v-9H3v9a1 1 0 001 1h16zm-2-8a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4a1 1 0 011-1h4zm-1 4v-2h-2v2h2z"></path></svg>)
    const creditCardIcon = (<svg width="24" height="24" class="icon_svg"><path d="M9.46 17.52a1 1 0 01-.71-.29l-4-4a1.004 1.004 0 111.42-1.42l3.25 3.26 8.33-8.34a1.004 1.004 0 011.42 1.42l-9 9a1 1 0 01-.71.37z"></path></svg>)

    const websiteIcon = (<svg width="24" height="24" class="icon_svg"><path d="M20.47 3.07a.5.5 0 01.53.46v6a.5.5 0 01-.39.49.58.58 0 01-.19 0 .47.47 0 01-.35-.15L17.8 7.6l-5 5a1 1 0 01-1.41 0 1 1 0 010-1.41l5-5-2.27-2.27a.5.5 0 01.35-.85h6zM20 21H4a1 1 0 01-1-1V4a1 1 0 011-1h6a1 1 0 010 2H5v14h14v-5a1 1 0 012 0v6a1 1 0 01-1 1z"></path></svg>)
    const phoneIcon = (<svg width="24" height="24" class="icon_svg"><path d="M13.59 23.07A7 7 0 018.64 21L3 15.36a7 7 0 010-9.9l1.39-1.41a1 1 0 011.42 0l5 5a1 1 0 010 1.41 2.001 2.001 0 002.83 2.83 1 1 0 011.41 0l4.95 5a1 1 0 010 1.42L18.54 21a7 7 0 01-4.95 2.07zM5.1 6.17l-.71.71a5 5 0 000 7.07l5.66 5.66a5 5 0 007.07 0l.71-.71-3.63-3.63a4 4 0 01-4.86-.61 4 4 0 01-.61-4.86L5.1 6.17zm12.78 5.95a1 1 0 01-1-1 4 4 0 00-4-4 1 1 0 010-2 6 6 0 016 6 1 1 0 01-1 1zm4.19 0a1 1 0 01-1-1 8.19 8.19 0 00-8.19-8.19 1 1 0 010-2c5.625.006 10.184 4.565 10.19 10.19a1 1 0 01-1 1z"></path></svg>)
    const addressIcon = (<svg width="24" height="24" viewBox="0 0 22 22" class="icon_svg"><path d="M11 22a3 3 0 01-2.12-.88l-8-8a3 3 0 010-4.24l8-8a3 3 0 014.24 0l8 8a3 3 0 010 4.24l-8 8A3 3 0 0111 22zm0-20a1 1 0 00-.71.29l-8 8a1 1 0 000 1.42l8 8a1 1 0 001.42 0l8-8a1 1 0 000-1.42l-8-8A1 1 0 0011 2zm4.85 8.15a.48.48 0 010 .66l-3 3a.47.47 0 01-.35.15.43.43 0 01-.19 0 .5.5 0 01-.31-.46v-2.05a1 1 0 01-.25.05h-2a1 1 0 00-1 1v1a1 1 0 11-2 0v-1a3 3 0 013-3h2a1 1 0 01.25.05V7.5a.5.5 0 01.31-.5.47.47 0 01.54.15l3 3z"></path></svg>)

    return (
        <>
            {isLoaded && (
                <div className="single-page-container">
                    <div className="top-section">
                        <div className="photos">
                            {
                                singleRestaurant.restaurantImages.map(image => {
                                    return (
                                        <img className="singlePhoto" alt="" key={image.id} src={image.url} />
                                    )
                                })
                            }
                        </div>
                        <div className="summary-line">
                            <h1>{singleRestaurant.name}</h1>
                            <div className="one-line-review">
                                <span><RatingStar size="32" rating={singleRestaurant.avgStarRating} /></span>
                                <span className="num-reviews">{singleRestaurant.numReviews} reviews</span>
                            </div>
                            <div className="price">Unclaimed <b>·</b> {singleRestaurant.price}</div>
                            <div className="price"><span className="single-green-word">Open</span> until 9:30PM</div>
                        </div>
                        <OpenModalButton
                            className="see-all-photo"
                            buttonText="See all photos"
                            modalComponent={<DisplayPhotos singleRestaurant={singleRestaurant} />}
                        />
                    </div>
                    <div className="bottom-section">
                        <div className="bottom-left-section">
                            {sessionUser && (
                                <><div className="buttons">
                                    <OpenModalButton
                                        buttonText="Add photo"
                                        modalComponent={<AddPhotoModal restaurantId={restaurantId} />}
                                    />
                                    {sessionUser.id === singleRestaurant.user_id && (
                                        <>
                                            <OpenModalButton
                                                buttonText="Edit Restaurant"
                                                modalComponent={<EditRestaurant singleRestaurant={singleRestaurant} />}
                                            />
                                            <button
                                                onClick={() => setShowDeleteEdit(!showDeleteEdit)}
                                            >Delete Restaurant</button>
                                            {showDeleteEdit && (
                                                <DeleteRestaurant
                                                    singleRestaurant={singleRestaurant}
                                                    sessionUser={sessionUser}
                                                    dispatch={dispatch}
                                                    history={history}
                                                    restaurantId={restaurantId}
                                                    setShowDeleteEdit={setShowDeleteEdit}

                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                                </>
                            )}
                            <div className="restaurant-details">
                                <h2>Amenities and More</h2>
                                <div className="amenities">
                                    <div className="indi-amenity">{reservationIcon}<span>Takes Reservations</span></div>
                                    <div className="indi-amenity">{deliveryIcon}<span>Offers Delivery</span></div>
                                    <div className="indi-amenity">{takeoutIcon} <span>Offers Takeout</span></div>
                                    <div className="indi-amenity">{creditCardIcon}<span>Accepts Credit Cards</span></div>
                                </div>
                                <hr></hr>
                                <h2>About the Business</h2>
                                <div className="restaurant-description">{singleRestaurant.description}</div>
                                <hr></hr>
                                < GetAllReviews restaurantId={restaurantId} />
                            </div>
                        </div>
                        <div className="bottom-right-section">
                            <div className="side-bar">
                                <div className="website-line"><a className="bottom-border" href={singleRestaurant.website}>{singleRestaurant.website}</a>{websiteIcon}</div>
                                <div className="bottom-border phone-line"><span>{singleRestaurant.phone_number}</span>{phoneIcon}</div>
                                <div className="map-direction">
                                    <a href={getMap("https://www.google.com/maps/place/" + singleRestaurant.address + " " + singleRestaurant.city + " " + singleRestaurant.state + " " + singleRestaurant.zipcode)}>Get Direction</a>
                                    <div className="address-line">
                                        <div>
                                            <span>{singleRestaurant.address}, </span>
                                            <span>{singleRestaurant.city}, </span>
                                            <span>{singleRestaurant.state}, </span>
                                            <span>{singleRestaurant.zipcode}, </span>
                                            <span>{singleRestaurant.country}</span>
                                        </div>
                                        <div>{addressIcon}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}



export default SingleRestaurant
