import "./CreateRestaurantModal.css"
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModal } from "../../context/Modal";
import { useHistory } from 'react-router-dom';
import { addRestaurantThunk } from "../../store/restaurants";
import { parseErrors } from "../../utils/parseErrors";
import { uploadImage, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../utils/uploads";
import { MAX_DESCRIPTION_LENGTH, validateRestaurant } from "../../utils/restaurantValidation";

type ImageMode = "upload" | "url";

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
    const [imageMode, setImageMode] = useState<ImageMode>("upload")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const { closeModal } = useModal();
    const sessionUser = useSelector((state: any) => state.session.user)


    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors([]); // Clear previous errors

        // The field rules live in utils/restaurantValidation so this form and
        // the edit modal cannot drift apart again; the cover photo is ours.
        const validationErrors: string[] = validateRestaurant({
            name, price, address, city, state, zipcode, country, phone_number, website, description,
        });

        if (imageMode === "upload" && !imageFile) validationErrors.push("Choose a cover photo for the restaurant");
        if (imageMode === "url" && !url.trim()) validationErrors.push("Cover photo URL is required");
        if (imageMode === "url" && url.trim() && !/^https?:\/\/.+/.test(url.trim())) validationErrors.push("Image URL must start with http:// or https://");

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            setIsSubmitting(false);
            return;
        }

        // Upload the cover photo first so the restaurant can be created with its URL.
        let imageUrl = url.trim();
        if (imageMode === "upload" && imageFile) {
            const upload = await uploadImage(imageFile);
            if (!upload.url) {
                setErrors(upload.errors || ["Could not upload the cover photo. Please try again."]);
                setIsSubmitting(false);
                return;
            }
            imageUrl = upload.url;
        }

      const newRestaurant = {
        user_id: sessionUser.id,
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
        url: imageUrl,
      };

        try {
            const createdRestaurantId = await (dispatch as any)(addRestaurantThunk(newRestaurant));
            closeModal();
            history.push(`/single/${createdRestaurantId}`);
        } catch (res: any) {
            // addRestaurantThunk throws the failed response itself; a dropped
            // connection throws a TypeError from fetch instead.
            setErrors(typeof res?.json === "function"
                ? await parseErrors(res, "An error occurred while creating the restaurant. Please try again.")
                : ["Network error. Please check your connection and try again."]);
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
                        type="text"
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
                    <div className="image-picker">
                        <div className="image-picker-tabs" role="tablist" aria-label="Cover photo source">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={imageMode === "upload"}
                                className={imageMode === "upload" ? "active" : ""}
                                onClick={() => setImageMode("upload")}
                            >
                                <i className="fa-solid fa-upload"></i> Upload cover photo
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={imageMode === "url"}
                                className={imageMode === "url" ? "active" : ""}
                                onClick={() => setImageMode("url")}
                            >
                                <i className="fa-solid fa-link"></i> Use an image URL
                            </button>
                        </div>
                        {imageMode === "upload" ? (
                            <label className="image-picker-file">
                                <input
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES}
                                    onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                                />
                                <span className="image-picker-file-button"><i className="fa-regular fa-image"></i> Choose photo</span>
                                <span className="image-picker-file-name">
                                    {imageFile ? imageFile.name : `PNG, JPG, GIF, or WEBP up to ${MAX_UPLOAD_MB} MB`}
                                </span>
                            </label>
                        ) : (
                            <input
                                type="text"
                                placeholder="Cover Image URL (https://...)"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        )}
                    </div>
                    <div className="description-field">
                        <textarea
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            maxLength={MAX_DESCRIPTION_LENGTH}
                            required
                        />
                        <span className={`description-count${description.length > MAX_DESCRIPTION_LENGTH - 50 ? " near-limit" : ""}`}>
                            {description.length}/{MAX_DESCRIPTION_LENGTH}
                        </span>
                    </div>
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
