import "./DeleteRestaurant.css"
import { deleteRestaurantThunk } from "../../store/restaurants"
import { getAllRestaurants } from "../../store/restaurants"

function DeleteRestaurant({ singleRestaurant, sessionUser, dispatch, restaurantId, history, setShowDeleteEdit }) {

    let sessionLinks;

    const handleDelete = (e) => {
        e.preventDefault();
        dispatch(deleteRestaurantThunk(+restaurantId))
            .then(() => dispatch(getAllRestaurants()))
            .then(() => history.push("/"))
        setShowDeleteEdit(false)
    }

    if (sessionUser) {

        const currentUserId = sessionUser.id
        const restaurantOwnerId = singleRestaurant.user_id

        if (currentUserId === restaurantOwnerId) {
            sessionLinks = (
                <div>
                    <button
                        onClick={handleDelete}
                    >Confirm Delete</button>
                </div>
            )
        } else if (currentUserId !== restaurantOwnerId) {
            sessionLinks = (
                <p>You are not the owner</p>
            )
        }
    }
    return (
        <>
            {sessionUser && (sessionLinks)}
            {!sessionUser && (
                <div>Please log in to delete the Restaurant</div>
            )}
        </>
    )
}


export default DeleteRestaurant
