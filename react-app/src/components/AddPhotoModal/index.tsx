import "./AddPhoto.css"
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useModal } from "../../context/Modal";
import { addRestaurantImage } from "../../store/restaurantPhoto";
import { AppDispatch } from "../../store";

interface AddPhotoModalProps {
    restaurantId: string | number;
}

function AddPhotoModal({ restaurantId }: AddPhotoModalProps): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    const [url, setUrl] = useState<string>("");
    const [preview, setPreview] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const { closeModal } = useModal()

    const newPhoto = {
        preview,
        url
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = await dispatch(addRestaurantImage(newPhoto, restaurantId) as any);
        if (data) {
            setErrors(data);
        } else {
            closeModal()
        }
    }

    return (
        <div>
            <h2 className="add-photo-text"><span>Add Photo</span></h2>
            <form className="add-photo-form" onSubmit={handleSubmit}>
                <ul className="error-display">
                    {errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                    ))}
                </ul>
                <label>
                    <input
                        type="text"
                        placeholder="Photo Url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                    />
                </label>
                <button type="submit">Add Photo</button>
            </form>
        </div>
    )
}

export default AddPhotoModal