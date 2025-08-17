import "./CreateRestaurantModal.css"
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModal } from "../../context/Modal";
import { useHistory } from 'react-router-dom';
import { addRestaurantThunk } from "../../store/restaurants";



function CreateRestaurantModal() {
    const dispatch = useDispatch();
    const history = useHistory();
    const [name, setName] = useState("");
    const [price, setPrice] = useState("$")
    const [address, setAddress] = useState("")
    const [city, setCity] = useState("")
    const [state, setState] = useState("")
    const [zipcode, setZipcode] = useState("")
    const [country, setCountry] = useState("")
    const [phone_number, setPhone_number] = useState("")
    const [description, setDescription] = useState("")
    const [website, setWebsite] = useState("")
    const [url, setUrl] = useState("")
    const [errors, setErrors] = useState<any[]>([]);
    const { closeModal } = useModal();
    const sessionUser = useSelector((state: any) => state.session.user)


    const handleSubmit = (e: any) => {
        e.preventDefault();

        // Perform client-side validation
        const validationErrors = [];

        if (!name) validationErrors.push("Name is required.");
        if (name.length < 1 || name.length > 100) validationErrors.push("Name must be between 1 and 50 characters.");
        if (address.length < 1 || address.length > 100) validationErrors.push("Address must be between 1 and 50 characters.");
        if (city.length < 1 || city.length > 100) validationErrors.push("City must be between 1 and 85 characters.");
        if (state.length !== 2) validationErrors.push("State must be 2 characters");
        if (zipcode.length !== 5) validationErrors.push("Zipcode must be 5 characters.");
        if (country.length < 1 || country.length > 56) validationErrors.push("Country must be between 1 and 56 characters.");
        if (phone_number.length < 1 || phone_number.length > 20) validationErrors.push("Phone Number must be between 1 and 20 characters.");
        if (website.length < 1 || website.length > 70) validationErrors.push("Website must be between 1 and 70 characters.");
        if (description.length < 1 || description.length > 500) validationErrors.push("Description must be between 1 and 500 characters.");
        if (!/^\$+$/.test(price)) validationErrors.push("Invalid price format.");
        if (!/\.com$/.test(website)) validationErrors.push("Invalid website format.");
        if (url && !/^https?:\/\/.+/.test(url)) validationErrors.push("Invalid preview image URL format.");
        if (!/^[()\-0-9]+$/.test(phone_number)) validationErrors.push("Phone Number must contain only digits, parentheses, and hyphens.");


        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return; // Exit if there are validation errors
        }

      const newRestaurant = {
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
        url,
      };

      return (dispatch as any)(addRestaurantThunk(newRestaurant))
        .then((createdRestaurantId: any) => {
          history.push(`/single/${createdRestaurantId}`);
          alert("restaurant has been created")
          closeModal();
        })
        .catch(async (res: any) => {
          const data = await res.json();
          if (data && data.errors) setErrors(data.errors);
        });
    };

    return (
        <>
            <h2 className="add-restaurant-text">Add Restaurant</h2>
            <form className="add-restaurant-form" onSubmit={handleSubmit}>
                <ul>
                    {errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                    ))}
                </ul>
                    <input
                        type="text"
                        value={name}
                        placeholder="Business Name"
                        onChange={(e) => setName(e.target.value)}
                        required

                    />
                    <select
                        onChange={(e) => setPrice(e.target.value)}
                        value={price}
                        >
                        <option value="$">$</option>
                        <option value="$$">$$</option>
                        <option value="$$$">$$$</option>
                        <option value="$$$$">$$$$</option>
                        <option value="$$$$$">$$$$$</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="City"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="State"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        required

                    />
                    <input
                        type="number"
                        placeholder="Zip Code"
                        value={zipcode}
                        onChange={(e) => setZipcode(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="Country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="Phone Number"
                        value={phone_number}
                        onChange={(e) => setPhone_number(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="Website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        required

                    />
                    <input
                        type="text"
                        placeholder="Preview Image Url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                    />
                    <input
                        type="textarea"
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required

                    />
                <button className="add-business-button" type="submit">Create Restaurant</button>
            </form>
        </>
    )
}

export default CreateRestaurantModal
