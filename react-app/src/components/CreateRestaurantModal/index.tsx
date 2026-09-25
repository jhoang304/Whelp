import "./CreateRestaurantModal.css"
import React, { useState } from "react";
import { useModal } from "../../context/Modal";
import { useHistory } from 'react-router-dom';
import { addRestaurantThunk } from "../../store/restaurants";
import { parseErrors } from "../../utils/parseErrors";
import { uploadImage, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../utils/uploads";
import { RestaurantFields, validateRestaurant } from "../../utils/restaurantValidation";
import { validateHours } from "../../utils/hours";
import { OpeningHours } from "../../types";
import { useAppDispatch } from "../../store";
import RestaurantForm from "../RestaurantForm";

type ImageMode = "upload" | "url";

const BLANK: RestaurantFields = {
    name: "",
    price: "$",
    address: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    phone_number: "",
    website: "",
    description: "",
};

function CreateRestaurantModal() {
    const dispatch = useAppDispatch();
    const history = useHistory();
    // One piece of state for the ten fields: the shape the rules and the
    // shared form already speak, in place of ten useState calls.
    const [fields, setFields] = useState<RestaurantFields>(BLANK);
    const [url, setUrl] = useState("")
    const [imageMode, setImageMode] = useState<ImageMode>("upload")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [categoryIds, setCategoryIds] = useState<number[]>([])
    const [amenityIds, setAmenityIds] = useState<number[]>([])
    const [hours, setHours] = useState<OpeningHours[]>([])
    // Set from the state on the server when it is left alone; the form
    // only carries one once an owner has chosen it.
    const [timezone, setTimezone] = useState<string | null>(null)
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const { closeModal } = useModal();


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors([]); // Clear previous errors

        // The field rules live in utils/restaurantValidation so this form and
        // the edit modal cannot drift apart again; the cover photo is ours.
        const validationErrors: string[] = [...validateRestaurant(fields), ...validateHours(hours)];

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

        // No user_id: the API takes the owner from the session, and trusting a
        // body field for it would be a bug rather than a convenience.
        const newRestaurant = {
            ...fields,
            zipcode: fields.zipcode.trim(),
            url: imageUrl,
            category_ids: categoryIds,
            amenity_ids: amenityIds,
            hours,
            timezone,
        };

        try {
            const createdRestaurantId = await dispatch(addRestaurantThunk(newRestaurant));
            closeModal();
            history.push(`/single/${createdRestaurantId}`);
        } catch (thrown: unknown) {
            // addRestaurantThunk throws the failed response itself; a dropped
            // connection throws a TypeError from fetch instead.
            const isResponse = (value: unknown): value is Response =>
                typeof (value as Response | undefined)?.json === "function";
            setErrors(isResponse(thrown)
                ? await parseErrors(thrown, "An error occurred while creating the restaurant. Please try again.")
                : ["Network error. Please check your connection and try again."]);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <h2 className="restaurant-form-title">Add Restaurant</h2>
            <RestaurantForm
                className="add-restaurant-form"
                required
                value={fields}
                onChange={setFields}
                categoryIds={categoryIds}
                onCategoryIdsChange={setCategoryIds}
                amenityIds={amenityIds}
                onAmenityIdsChange={setAmenityIds}
                hours={hours}
                onHoursChange={setHours}
                timezone={timezone}
                onTimezoneChange={setTimezone}
                errors={errors}
                busy={isSubmitting}
                submitLabel="Create Restaurant"
                busyLabel={<><i className="fa-solid fa-spinner fa-spin"></i>Creating Restaurant...</>}
                onSubmit={handleSubmit}
            >
                {/* The cover photo is create's own: an existing restaurant
                    changes its photos through the photo routes instead. */}
                <div className="image-picker">
                    <span className="restaurant-form-label">Cover Photo</span>
                    <div className="image-picker-tabs" role="group" aria-label="Cover photo source">
                        <button
                            type="button"
                            aria-pressed={imageMode === "upload"}
                            className={imageMode === "upload" ? "active" : ""}
                            onClick={() => setImageMode("upload")}
                        >
                            <i className="fa-solid fa-upload"></i> Upload cover photo
                        </button>
                        <button
                            type="button"
                            aria-pressed={imageMode === "url"}
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
                            aria-label="Cover image URL"
                            placeholder="Cover Image URL (https://...)"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    )}
                </div>
            </RestaurantForm>
        </>
    );
}

export default CreateRestaurantModal
