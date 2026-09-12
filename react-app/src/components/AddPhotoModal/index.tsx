import "./AddPhoto.css"
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useModal } from "../../context/Modal";
import { addRestaurantImage } from "../../store/restaurantPhoto";
import { AppDispatch } from "../../store";
import { uploadImage, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../utils/uploads";

interface AddPhotoModalProps {
    restaurantId: string | number;
}

type ImageMode = "upload" | "url";

const URL_PATTERN = /^https?:\/\/.+/i;

function AddPhotoModal({ restaurantId }: AddPhotoModalProps): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    const { closeModal } = useModal();

    const [mode, setMode] = useState<ImageMode>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState<string>("");
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Show a local preview of the chosen file and release it when it changes.
    useEffect(() => {
        if (!file) {
            setPreviewSrc(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewSrc(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        setFile(chosen);
        setErrors([]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrors([]);

        let imageUrl = url.trim();

        if (mode === "upload") {
            if (!file) {
                setErrors(["Choose a photo to upload."]);
                return;
            }
        } else if (!imageUrl) {
            setErrors(["Paste the URL of a photo."]);
            return;
        } else if (!URL_PATTERN.test(imageUrl)) {
            setErrors(["Photo URL must start with http:// or https://"]);
            return;
        }

        setIsSubmitting(true);

        if (mode === "upload" && file) {
            const upload = await uploadImage(file);
            if (!upload.url) {
                setErrors(upload.errors || ["Upload failed. Please try again."]);
                setIsSubmitting(false);
                return;
            }
            imageUrl = upload.url;
        }

        const result: string[] | null = await dispatch(addRestaurantImage({ url: imageUrl, preview: false }, restaurantId) as any);
        setIsSubmitting(false);

        if (result) {
            setErrors(result);
        } else {
            closeModal();
        }
    };

    return (
        <div className="add-photo-modal">
            <h2 className="add-photo-text"><span>Add Photo</span></h2>

            <div className="add-photo-mode" role="tablist" aria-label="Photo source">
                <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "upload"}
                    className={mode === "upload" ? "active" : ""}
                    onClick={() => { setMode("upload"); setErrors([]); }}
                >
                    <i className="fa-solid fa-upload"></i> Upload a photo
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "url"}
                    className={mode === "url" ? "active" : ""}
                    onClick={() => { setMode("url"); setErrors([]); }}
                >
                    <i className="fa-solid fa-link"></i> Paste a URL
                </button>
            </div>

            <form className="add-photo-form" onSubmit={handleSubmit}>
                {errors.length > 0 && (
                    <ul className="error-display">
                        {errors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                        ))}
                    </ul>
                )}

                {mode === "upload" ? (
                    <label className="add-photo-dropzone">
                        {previewSrc ? (
                            <img className="add-photo-preview" src={previewSrc} alt="Selected file" />
                        ) : (
                            <span className="add-photo-placeholder">
                                <i className="fa-regular fa-image"></i>
                                <span>Click to choose a photo</span>
                                <small>PNG, JPG, GIF, or WEBP up to {MAX_UPLOAD_MB} MB</small>
                            </span>
                        )}
                        <input
                            type="file"
                            accept={ACCEPTED_IMAGE_TYPES}
                            onChange={handleFileChange}
                        />
                        {file && <span className="add-photo-filename">{file.name}</span>}
                    </label>
                ) : (
                    <label className="add-photo-url">
                        <input
                            type="text"
                            placeholder="https://example.com/photo.jpg"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </label>
                )}

                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Adding...
                        </>
                    ) : (
                        "Add Photo"
                    )}
                </button>
            </form>
        </div>
    )
}

export default AddPhotoModal
