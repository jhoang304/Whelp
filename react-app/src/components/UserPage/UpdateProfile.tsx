import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../store";
import { UserProfile } from "../../types";
import { editProfileThunk, ProfileUpdates } from "../../store/userProfile";
import { useModal } from "../../context/Modal";
import { uploadImage, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB } from "../../utils/uploads";
import { avatarUrl, DEFAULT_AVATAR, onAvatarError } from "../../utils/images";
import "./UpdateProfile.css";

interface UpdateProfileProps {
    user: UserProfile;
}

type ImageMode = "upload" | "url";

const URL_PATTERN = /^https?:\/\/.+/i;

export default function UpdateProfile({ user }: UpdateProfileProps): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    const { closeModal } = useModal();

    const [username, setUsername] = useState<string>(user.username);
    const [firstName, setFirstName] = useState<string>(user.first_name || "");
    const [lastName, setLastName] = useState<string>(user.last_name || "");

    const [imageMode, setImageMode] = useState<ImageMode>("upload");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string>(user.profile_image_url || "");
    const [removeImage, setRemoveImage] = useState<boolean>(false);
    const [previewSrc, setPreviewSrc] = useState<string>(avatarUrl(user));

    const [errors, setErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Preview the chosen file locally; release the object URL when it changes.
    useEffect(() => {
        if (!imageFile) return;
        const objectUrl = URL.createObjectURL(imageFile);
        setPreviewSrc(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [imageFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        setImageFile(chosen);
        setRemoveImage(false);
        setErrors([]);
    };

    const handleUrlChange = (value: string) => {
        setImageUrl(value);
        setRemoveImage(false);
        if (URL_PATTERN.test(value.trim())) {
            setPreviewSrc(value.trim());
        }
    };

    const handleRemovePhoto = () => {
        setImageFile(null);
        setImageUrl("");
        setRemoveImage(true);
        setPreviewSrc(DEFAULT_AVATAR);
        setErrors([]);
    };

    const hasPhoto = !removeImage && (!!imageFile || !!imageUrl.trim() || !!user.profile_image_url);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrors([]);

        const validation: string[] = [];
        const trimmedUsername = username.trim();
        if (!trimmedUsername) validation.push("Username is required.");
        if (trimmedUsername.length > 40) validation.push("Username must be 40 characters or fewer.");
        if (firstName.trim().length > 50) validation.push("First name must be 50 characters or fewer.");
        if (lastName.trim().length > 50) validation.push("Last name must be 50 characters or fewer.");
        if (imageMode === "url" && imageUrl.trim() && !URL_PATTERN.test(imageUrl.trim())) {
            validation.push("Profile picture URL must start with http:// or https://");
        }
        if (validation.length > 0) {
            setErrors(validation);
            return;
        }

        setIsSaving(true);

        const updates: ProfileUpdates = {
            username: trimmedUsername,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
        };

        if (imageMode === "upload" && imageFile) {
            const upload = await uploadImage(imageFile);
            if (!upload.url) {
                setErrors(upload.errors || ["Could not upload your photo. Please try again."]);
                setIsSaving(false);
                return;
            }
            updates.profile_image_url = upload.url;
        } else if (removeImage) {
            updates.profile_image_url = "";
        } else if (imageMode === "url" && imageUrl.trim() !== (user.profile_image_url || "")) {
            updates.profile_image_url = imageUrl.trim();
        }

        const result: string[] | null = await dispatch(editProfileThunk(updates, user.id) as any);
        setIsSaving(false);

        if (result) {
            setErrors(result);
        } else {
            closeModal();
        }
    };

    return (
        <div className="update-profile-container">
            <h2 className="update-profile-title">Edit profile</h2>

            <form className="update-profile-form" onSubmit={handleSubmit}>
                {errors.length > 0 && (
                    <ul className="update-profile-errors">
                        {errors.map((error, idx) => (
                            <li key={idx} className="update-profile-errors-item">{error}</li>
                        ))}
                    </ul>
                )}

                <div className="update-profile-photo">
                    <img
                        className="update-profile-avatar"
                        src={previewSrc}
                        alt="Current avatar"
                        onError={onAvatarError}
                    />
                    <div className="update-profile-photo-controls">
                        <div className="update-profile-mode" role="tablist" aria-label="Photo source">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={imageMode === "upload"}
                                className={imageMode === "upload" ? "active" : ""}
                                onClick={() => setImageMode("upload")}
                            >
                                Upload
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={imageMode === "url"}
                                className={imageMode === "url" ? "active" : ""}
                                onClick={() => setImageMode("url")}
                            >
                                Use a URL
                            </button>
                        </div>

                        {imageMode === "upload" ? (
                            <label className="update-profile-file">
                                <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleFileChange} />
                                <span className="update-profile-file-button">
                                    <i className="fa-solid fa-upload"></i> Choose photo
                                </span>
                                <span className="update-profile-file-name">
                                    {imageFile ? imageFile.name : `PNG, JPG, GIF, or WEBP up to ${MAX_UPLOAD_MB} MB`}
                                </span>
                            </label>
                        ) : (
                            <input
                                className="update-profile-url"
                                type="text"
                                placeholder="https://example.com/me.jpg"
                                value={imageUrl}
                                onChange={(e) => handleUrlChange(e.target.value)}
                            />
                        )}

                        {hasPhoto && (
                            <button type="button" className="update-profile-remove" onClick={handleRemovePhoto}>
                                <i className="fa-solid fa-trash"></i> Remove photo
                            </button>
                        )}
                    </div>
                </div>

                <label className="update-profile-item">
                    <span>Username</span>
                    <input
                        type="text"
                        value={username}
                        maxLength={40}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </label>

                <div className="update-profile-row">
                    <label className="update-profile-item">
                        <span>First name</span>
                        <input
                            type="text"
                            value={firstName}
                            maxLength={50}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                    </label>
                    <label className="update-profile-item">
                        <span>Last name</span>
                        <input
                            type="text"
                            value={lastName}
                            maxLength={50}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </label>
                </div>

                <div className="update-profile-buttons">
                    <button type="button" className="update-profile-cancel" onClick={closeModal} disabled={isSaving}>
                        Cancel
                    </button>
                    <button type="submit" className="update-profile-save" disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
