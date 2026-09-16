import "./EditRestaurant.css"
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModal } from "../../context/Modal";
import { updateRestaurantThunk } from "../../store/restaurants"
import { AppDispatch } from "../../store";
import { RootState } from "../../types";
import { MAX_DESCRIPTION_LENGTH, validateRestaurant } from "../../utils/restaurantValidation";

interface EditRestaurantProps {
    singleRestaurant: any;
}

export default function EditRestaurant({ singleRestaurant }: EditRestaurantProps): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    // Declared before handleUpdate rather than after it: the handler reads it,
    // and the old file only got away with that because of closure timing.
    const sessionUser = useSelector((rootState: RootState) => rootState.session.user);

    const [name, setName] = useState<string>(singleRestaurant.name);
    const [price, setPrice] = useState<string>(singleRestaurant.price)
    const [address, setAddress] = useState<string>(singleRestaurant.address)
    const [city, setCity] = useState<string>(singleRestaurant.city)
    const [state, setState] = useState<string>(singleRestaurant.state)
    const [zipcode, setZipcode] = useState<string>(String(singleRestaurant.zipcode ?? ""))
    const [country, setCountry] = useState<string>(singleRestaurant.country)
    const [phone_number, setPhone_number] = useState<string>(singleRestaurant.phone_number)
    const [description, setDescription] = useState<string>(singleRestaurant.description)
    const [website, setWebsite] = useState<string>(singleRestaurant.website)
    const [errors, setErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const { closeModal } = useModal();

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const validationErrors = validateRestaurant({
            name, price, address, city, state, zipcode, country, phone_number, website, description,
        });

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors([]);
        setIsSaving(true);

        // The thunk returns the server's messages instead of throwing, so a
        // rejected save (400, or a 403 from someone who no longer owns the
        // business) is shown here. The modal used to close before the PUT had
        // even resolved, and its .catch could never fire. The catch below is
        // the backstop for anything the thunk cannot turn into messages, such
        // as a 200 whose body is not JSON: without it the modal would sit on
        // "Saving..." for good.
        let failures: string[] | null;
        try {
            failures = await dispatch(updateRestaurantThunk({
                id: singleRestaurant.id,
                // The server keeps the existing owner; never try to reassign it.
                user_id: singleRestaurant.user_id,
                name,
                price,
                address,
                city,
                state,
                zipcode: zipcode.trim(),
                country,
                phone_number,
                description,
                website,
            }) as any);
        } catch (unexpected) {
            failures = ["Something went wrong saving your changes. Please try again."];
        }

        // Reset before closing rather than in a `finally`: closeModal unmounts
        // this component, so a reset after it would set state on an unmounted
        // one. Every path that leaves the modal open lands here first.
        setIsSaving(false);

        if (failures) {
            setErrors(failures);
            return;
        }

        closeModal();
    }

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
                        <ul className="update-restaurant-errors">
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
                            <div className="description-field">
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    maxLength={MAX_DESCRIPTION_LENGTH}
                                />
                                <span className={`description-count${description.length > MAX_DESCRIPTION_LENGTH - 50 ? " near-limit" : ""}`}>
                                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                                </span>
                            </div>
                        </label>
                        <label>
                            <span>Price Range</span>
                            <select
                            className="price-selector"
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
                            disabled={isSaving}
                        >{isSaving ? "Saving..." : "Submit"}</button>
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
