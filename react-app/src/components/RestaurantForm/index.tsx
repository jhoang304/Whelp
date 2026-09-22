import React from "react";

import "./RestaurantForm.css";
import CategoryPicker from "../CategoryPicker";
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
 * closes itself. The form renders; it decides nothing. Each modal keeps its
 * own wrapper class, so the stylesheets that key off `.add-restaurant-form`
 * and `.update-restaurant-form` keep working untouched.
 */

/** Create names its fields with placeholders, edit with labels beside them. */
export type FieldLabels = "placeholder" | "inline";

interface RestaurantFormProps {
    value: RestaurantFields;
    onChange: (next: RestaurantFields) => void;
    categoryIds: number[];
    onCategoryIdsChange: (ids: number[]) => void;
    labels: FieldLabels;
    errors: string[];
    busy: boolean;
    submitLabel: React.ReactNode;
    busyLabel: React.ReactNode;
    submitClassName?: string;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    /** `.add-restaurant-form` or `.update-restaurant-form`: their CSS keys off it. */
    className: string;
    /** create's cover-photo picker, which edit has no use for */
    children?: React.ReactNode;
}

type TextField = {
    name: Exclude<keyof RestaurantFields, "price" | "description">;
    label: string;
    placeholder: string;
};

const TEXT_FIELDS: TextField[] = [
    { name: "name", label: "Name", placeholder: "Business Name" },
    { name: "address", label: "Address", placeholder: "Address" },
    { name: "city", label: "City", placeholder: "City" },
    { name: "state", label: "State", placeholder: "State" },
    { name: "zipcode", label: "Zipcode", placeholder: "Zip Code" },
    { name: "country", label: "Country", placeholder: "Country" },
    { name: "phone_number", label: "Phone Number", placeholder: "Phone Number" },
    { name: "website", label: "Website", placeholder: "Website" },
];

/** Where the price select sits: second, straight after the name. */
const PRICE_AFTER = "name";

export const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$", "$$$$$"];

function RestaurantForm({
    value, onChange, categoryIds, onCategoryIdsChange, labels, errors, busy,
    submitLabel, busyLabel, submitClassName, onSubmit, className, children,
}: RestaurantFormProps): React.JSX.Element {
    const inline = labels === "inline";

    // Only the create form has ever marked its inputs required, and the two
    // validations would talk over each other: the browser's bubble appears
    // before the form's own message list can. Keeping it as it was means this
    // refactor changes nothing anyone can see.
    const required = !inline;

    const set = (name: keyof RestaurantFields) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [name]: event.target.value });

    /** An input on its own in create, and beside its label in edit. */
    const labelled = (label: string, control: React.ReactNode) =>
        inline ? <label key={label}><span>{label}</span>{control}</label> : control;

    const priceSelect = labelled("Price Range", (
        <select
            className="price-selector"
            aria-label="Price Range"
            value={value.price}
            onChange={set("price")}
        >
            {PRICE_OPTIONS.map((price) => (
                <option key={price} value={price}>{price}</option>
            ))}
        </select>
    ));

    const description = labelled("Description", (
        <div className="description-field">
            <textarea
                value={value.description}
                placeholder={inline ? undefined : "Description"}
                aria-label="Description"
                onChange={set("description")}
                rows={4}
                maxLength={MAX_DESCRIPTION_LENGTH}
                required={required}
            />
            <span className={`description-count${value.description.length > MAX_DESCRIPTION_LENGTH - 50 ? " near-limit" : ""}`}>
                {value.description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
        </div>
    ));

    return (
        <form className={className} onSubmit={onSubmit}>
            {errors.length > 0 && (
                <div className="error-container">
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
                            type="text"
                            value={value[field.name]}
                            placeholder={inline ? undefined : field.placeholder}
                            aria-label={field.label}
                            onChange={set(field.name)}
                            required={required}
                        />
                    ))}
                    {field.name === PRICE_AFTER && priceSelect}
                </React.Fragment>
            ))}

            {description}

            <CategoryPicker selected={categoryIds} onChange={onCategoryIdsChange} />

            {children}

            <button className={submitClassName} type="submit" disabled={busy}>
                {busy ? busyLabel : submitLabel}
            </button>
        </form>
    );
}

export default RestaurantForm;
