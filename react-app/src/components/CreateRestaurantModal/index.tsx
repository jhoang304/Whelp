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
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const { closeModal } = useModal();
    const sessionUser = useSelector((state: any) => state.session.user)


    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors([]); // Clear previous errors

        // Perform client-side validation
        const validationErrors: string[] = [];

        // Required field validation
        if (!name.trim()) validationErrors.push("Restaurant name is required");
        if (!address.trim()) validationErrors.push("Address is required");
        if (!city.trim()) validationErrors.push("City is required");
        if (!state.trim()) validationErrors.push("State is required");
        if (!zipcode.trim()) validationErrors.push("Zip code is required");
        if (!country.trim()) validationErrors.push("Country is required");
        if (!phone_number.trim()) validationErrors.push("Phone number is required");
        if (!website.trim()) validationErrors.push("Website is required");
        if (!description.trim()) validationErrors.push("Description is required");

        // Length validation
        if (name.length > 100) validationErrors.push("Restaurant name must be 100 characters or less");
        if (address.length > 100) validationErrors.push("Address must be 100 characters or less");
        if (city.length > 85) validationErrors.push("City must be 85 characters or less");
        if (country.length > 56) validationErrors.push("Country must be 56 characters or less");
        if (description.length > 500) validationErrors.push("Description must be 500 characters or less");
        if (website.length > 70) validationErrors.push("Website must be 70 characters or less");

        // Format validation
        if (state && state.length !== 2) validationErrors.push("State must be exactly 2 characters (e.g., CA, NY)");
        if (zipcode && !/^\d{5}$/.test(zipcode)) validationErrors.push("Zip code must be exactly 5 digits");
        if (phone_number && !/^[\d\s\-\(\)]+$/.test(phone_number)) validationErrors.push("Phone number can only contain digits, spaces, hyphens, and parentheses");
        if (website && !website.includes('.')) validationErrors.push("Please enter a valid website URL (e.g., example.com)");
        if (url && url.trim() && !/^https?:\/\/.+/.test(url)) validationErrors.push("Image URL must start with http:// or https://");

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            setIsSubmitting(false);
            return;
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

        try {
            const createdRestaurantId = await (dispatch as any)(addRestaurantThunk(newRestaurant));
            closeModal();
            history.push(`/single/${createdRestaurantId}`);
        } catch (res: any) {
            try {
                const data = await res.json();
                if (data && data.errors) {
                    // Handle different error formats
                    if (Array.isArray(data.errors)) {
                        setErrors(data.errors);
                    } else if (typeof data.errors === 'object') {
                        // Convert object errors to array
                        const errorMessages = Object.values(data.errors).flat() as string[];
                        setErrors(errorMessages);
                    } else {
                        setErrors([data.errors]);
                    }
                } else if (data.message) {
                    setErrors([data.message]);
                } else {
                    setErrors(["An error occurred while creating the restaurant. Please try again."]);
                }
            } catch (parseError) {
                setErrors(["Network error. Please check your connection and try again."]);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <h2 className="add-restaurant-text">Add Restaurant</h2>
            <form className="add-restaurant-form" onSubmit={handleSubmit}>
                {errors.length > 0 && (
                    <div className="error-container">
                        <div className="error-header">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            Please fix the following errors:
                        </div>
                        <ul className="error-list">
                            {errors.map((error, idx) => (
                                <li key={idx} className="error-item">{error}</li>
                            ))}
                        </ul>
                    </div>
                )}
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
                <button 
                    className="add-business-button" 
                    type="submit" 
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            Creating Restaurant...
                        </>
                    ) : (
                        'Create Restaurant'
                    )}
                </button>
            </form>
        </>
    )
}

export default CreateRestaurantModal
