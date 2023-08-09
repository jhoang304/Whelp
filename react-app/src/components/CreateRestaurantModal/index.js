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
    const [errors, setErrors] = useState([]);
    const { closeModal } = useModal();
    const sessionUser = useSelector(state => state.session.user)


    const handleSubmit = (e) => {
      e.preventDefault();

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

      return dispatch(addRestaurantThunk(newRestaurant))
        .then((createdRestaurantId) => {
          history.push(`/single/${createdRestaurantId}`);
          alert("restaurant has been created")
          closeModal();
        })
        .catch(async (res) => {
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
                <button className="add-business-button" type="submit">Add Business</button>
            </form>
        </>
    )
}

export default CreateRestaurantModal
