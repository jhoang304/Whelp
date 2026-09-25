import React, { useEffect, useId } from "react";

import "./RestaurantForm.css";
import ChipPicker from "../ChipPicker";
import HoursEditor from "../HoursEditor";
import { getAmenities, getCategories, MAX_CATEGORIES } from "../../store/categories";
import { useAppDispatch, useAppSelector } from "../../store";
import { OpeningHours } from "../../types";
import { MAX_DESCRIPTION_LENGTH, RestaurantFields } from "../../utils/restaurantValidation";

/**
 * The ten fields a restaurant has, in one place.
 *
 * The create and edit modals kept their own copy of these, and drifted twice
 * over rules that are now shared (a `.com` website test, a phone allowlist),
 * and once more over markup: adding the cuisine picker meant wiring it into
 * both, and then fixing the same CSS collision in both.
 *
 * What is left in the modals is what genuinely differs -- create uploads a
 * cover photo and redirects to the new page, edit is behind an owner gate and
 * closes itself. The form renders; it decides nothing.
 *
 * Every field has a visible label above it, in both. Create used to name its
 * fields only with placeholders, which vanish as soon as you type, and edit
 * put its labels in a 100px column beside 500px inputs -- a form 700px wide
 * that no phone could show. Stacked labels suit both, at any width.
 */

interface RestaurantFormProps {
    value: RestaurantFields;
    onChange: (next: RestaurantFields) => void;
    categoryIds: number[];
    onCategoryIdsChange: (ids: number[]) => void;
    amenityIds: number[];
    onAmenityIdsChange: (ids: number[]) => void;
    hours: OpeningHours[];
    onHoursChange: (hours: OpeningHours[]) => void;
    timezone: string | null;
    onTimezoneChange: (timezone: string | null) => void;
    /**
     * Let the browser refuse empty fields before the form's own checks run.
     * Only create has ever done this, and edit keeps it off: the browser's
     * bubble appears first and talks over the form's own list of errors.
     */
    required?: boolean;
    errors: string[];
    busy: boolean;
    submitLabel: React.ReactNode;
    busyLabel: React.ReactNode;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    /** `.add-restaurant-form` or `.update-restaurant-form`, for what differs. */
    className: string;
    /** create's cover-photo picker, which edit has no use for */
    children?: React.ReactNode;
}

type TextField = {
    name: Exclude<keyof RestaurantFields, "price" | "description">;
    label: string;
    /** An example, where the format is not obvious -- never the label again. */
    placeholder?: string;
    type?: "text" | "tel";
};

const TEXT_FIELDS: TextField[] = [
    { name: "name", label: "Business Name" },
    { name: "address", label: "Address" },
    { name: "city", label: "City" },
    { name: "state", label: "State", placeholder: "CA" },
    { name: "zipcode", label: "Zip Code" },
    { name: "country", label: "Country" },
    { name: "phone_number", label: "Phone Number", placeholder: "(555) 123-4567", type: "tel" },
    // Not type="url": that makes the browser demand a scheme, and the form
    // accepts "example.com" on purpose.
    { name: "website", label: "Website", placeholder: "example.com" },
];

/** Where the price select sits: second, straight after the name. */
const PRICE_AFTER = "name";

export const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$", "$$$$$"];

function RestaurantForm({
    value, onChange, categoryIds, onCategoryIdsChange, amenityIds, onAmenityIdsChange,
    hours, onHoursChange, timezone, onTimezoneChange, required = false, errors, busy,
    submitLabel, busyLabel, onSubmit, className, children,
}: RestaurantFormProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const idPrefix = useId();
    const categories = useAppSelector((state) => state.categories.list);
    const amenities = useAppSelector((state) => state.categories.amenities);

    useEffect(() => {
        // Two closed lists, shared by every form that offers them, so they are
        // fetched once and kept.
        if (categories.length === 0) dispatch(getCategories());
        if (amenities.length === 0) dispatch(getAmenities());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const set = (name: keyof RestaurantFields) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [name]: event.target.value });

    const labelled = (label: string, control: React.ReactNode) => (
        <label className="restaurant-form-field" key={label}>
            <span className="restaurant-form-label">{label}</span>
            {control}
        </label>
    );

    const priceSelect = labelled("Price Range", (
        <select
            className="price-selector"
            value={value.price}
            onChange={set("price")}
        >
            {PRICE_OPTIONS.map((price) => (
                <option key={price} value={price}>{price}</option>
            ))}
        </select>
    ));

    // Not wrapped in its label like the others: the counter would sit inside
    // it and become part of the field's name ("Description 0/500").
    const description = (
        <div className="restaurant-form-field">
            <label className="restaurant-form-label" htmlFor={`${idPrefix}-description`}>Description</label>
            <textarea
                id={`${idPrefix}-description`}
                value={value.description}
                onChange={set("description")}
                rows={4}
                maxLength={MAX_DESCRIPTION_LENGTH}
                required={required}
                aria-describedby={`${idPrefix}-description-count`}
            />
            <span
                id={`${idPrefix}-description-count`}
                className={`description-count${value.description.length > MAX_DESCRIPTION_LENGTH - 50 ? " near-limit" : ""}`}
            >
                {value.description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
        </div>
    );

    return (
        <form className={`restaurant-form ${className}`} onSubmit={onSubmit}>
            {errors.length > 0 && (
                <div className="error-container" role="alert">
                    <div className="error-header">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        Please fix the following errors:
                    </div>
                    <ul className="error-list">
                        {errors.map((error, index) => (
                            <li key={index} className="error-item">{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {TEXT_FIELDS.map((field) => (
                <React.Fragment key={field.name}>
                    {labelled(field.label, (
                        <input
                            type={field.type || "text"}
                            value={value[field.name]}
                            placeholder={field.placeholder}
                            onChange={set(field.name)}
                            required={required}
                        />
                    ))}
                    {field.name === PRICE_AFTER && priceSelect}
                </React.Fragment>
            ))}

            {description}

            <ChipPicker
                title="Cuisines"
                options={categories}
                selected={categoryIds}
                onChange={onCategoryIdsChange}
                max={MAX_CATEGORIES}
            />

            <ChipPicker
                title="Amenities"
                options={amenities}
                selected={amenityIds}
                onChange={onAmenityIdsChange}
            />

            <HoursEditor
                value={hours}
                onChange={onHoursChange}
                timezone={timezone}
                onTimezoneChange={onTimezoneChange}
            />

            {children}

            <button className="restaurant-form-submit" type="submit" disabled={busy}>
                {busy ? busyLabel : submitLabel}
            </button>
        </form>
    );
}

export default RestaurantForm;
