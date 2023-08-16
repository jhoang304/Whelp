import "./EditRestaurant.css"
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModal } from "../../context/Modal";
import { updateRestaurantThunk } from "../../store/restaurants"


export default function EditRestaurant({ singleRestaurant }) {
    const dispatch = useDispatch();
    const [name, setName] = useState(singleRestaurant.name);
    const [price, setPrice] = useState(singleRestaurant.price)
    const [address, setAddress] = useState(singleRestaurant.address)
    const [city, setCity] = useState(singleRestaurant.city)
    const [state, setState] = useState(singleRestaurant.state)
    const [zipcode, setZipcode] = useState(singleRestaurant.zipcode)
    const [country, setCountry] = useState(singleRestaurant.country)
    const [phone_number, setPhone_number] = useState(singleRestaurant.phone_number)
    const [description, setDescription] = useState(singleRestaurant.description)
    const [website, setWebsite] = useState(singleRestaurant.website)
    const [errors, setErrors] = useState([]);
    const { closeModal } = useModal();

    const handleUpdate = (e) => {
        e.preventDefault();

        // Perform client-side validation
        const validationErrors = [];

        if (!name) validationErrors.push("Name is required.");
        if (name.length < 1 || name.length > 100) validationErrors.push("Name must be between 1 and 50 characters.");
        if (address.length < 1 || address.length > 100) validationErrors.push("Address must be between 1 and 50 characters.");
        if (city.length < 1 || city.length > 100) validationErrors.push("City must be between 1 and 85 characters.");
        if (state.length !== 2) validationErrors.push("State must be 2 characters");
        // if (zipcode.length !== 5) validationErrors.push("Zipcode must be 5 characters.");
        if (!/^\d{5}$/.test(zipcode)) validationErrors.push("Zipcode must be a valid 5-digit number.");
        if (country.length < 1 || country.length > 56) validationErrors.push("Country must be between 1 and 56 characters.");
        if (phone_number.length < 1 || phone_number.length > 20) validationErrors.push("Phone Number must be between 1 and 20 characters.");
        if (website.length < 1 || website.length > 70) validationErrors.push("Website must be between 1 and 70 characters.");
        if (description.length < 1 || description.length > 500) validationErrors.push("Description must be between 1 and 500 characters.");
        if (!/^\$+$/.test(price)) validationErrors.push("Invalid price format.");
        // if (!/^https?:\/\/.+/.test(website)) validationErrors.push("Invalid website format.");
        if (!/\.com$/.test(website)) validationErrors.push("Invalid website format.");

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return; // Exit if there are validation errors
        }

        const updatedRestaurant = {
            id: singleRestaurant.id,
            user_id: sessionUser.id,
            name,
            price,
            address,
            city,
            state,
            zipcode,
            country,
            phone_number,
            description,
            website,
        }

        dispatch(updateRestaurantThunk(updatedRestaurant))
            .then(closeModal())
            .catch(
                async (res) => {
                    const data = await res.json();
                    if (data && data.errors) setErrors(data.errors);
                }
            )
    }

    const sessionUser = useSelector(state => state.session.user);

    let sessionLinks;

    if (sessionUser) {
        const currentUserId = sessionUser.id
        const restaurantOwnerId = singleRestaurant.user_id
        if (currentUserId === restaurantOwnerId) {
            sessionLinks = (
                <>
                    <form
                        className="update-restaurant-form"
                        onSubmit={handleUpdate}
                    >
                        <ul>
                            {errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                            ))}
                        </ul>
                        <label>
                            <span>Name</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Address</span>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>City</span>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>State</span>
                            <input
                                type="text"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Country</span>
                            <input
                                type="text"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Zipcode</span>
                            <input
                                type="text"
                                value={zipcode}
                                onChange={(e) => setZipcode(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Description</span>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Price Range</span>
                            <select
                            class="price-selector"
                            onChange={(e) => setPrice(e.target.value)}
                            value={price}
                            >
                            <option value="$">$</option>
                            <option value="$$">$$</option>
                            <option value="$$$">$$$</option>
                            <option value="$$$$">$$$$</option>
                            <option value="$$$$$">$$$$$</option>
                            </select>
                        </label>
                        <label>
                            <span>Phone Number</span>
                            <input
                                type="text"
                                value={phone_number}
                                onChange={(e) => setPhone_number(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Website</span>
                            <input
                                type="text"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                            />
                        </label>
                        <button
                            type="submit"
                        >Submit</button>
                    </form>
                </>
            )
        } else if ((currentUserId !== restaurantOwnerId)) {
            sessionLinks = (
                <p>You are not the owner</p>
            )
        }
    } else {
        sessionLinks = (
            <div>
                Please log in to update the restaurant
            </div>
        )
    }
    return (
        <>
            <h2 className="edit-restaurant-text">Edit Restaurant</h2>
            {sessionLinks}
        </>
    )
}
