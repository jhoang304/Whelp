import React, { useEffect, useId, useRef } from "react";

import "./RestaurantForm.css";
import ChipPicker from "../ChipPicker";
import HoursEditor from "../HoursEditor";
import { getAmenities, getCategories, MAX_CATEGORIES } from "../../store/categories";
import { useAppDispatch, useAppSelector } from "../../store";
import { OpeningHours } from "../../types";
import { MAX_DESCRIPTION_LENGTH, RestaurantFields } from "../../utils/restaurantValidation";

/**
 * The fields a restaurant has, in one place, for the create and edit modals.
 *
 * The modals kept their own copies of these and drifted three times, over
 * rules (a `.com` website test, a phone allowlist) and over markup. What is
 * left in the modals is what genuinely differs: create uploads a cover photo
 * and opens the new page, edit is behind an owner gate and closes itself.
 * The form renders; it decides nothing.
 *
 * Laid out as a modal of its own: a header that says what this is and can
 * close it, the fields in short sections with a line on what each is for,
 * and a footer whose Cancel and Save stay in reach however far down the
 * hours you have scrolled. Every field has a visible label.
 */

interface RestaurantFormProps {
    /** "Add a restaurant", "Edit Nancy's Hustle": the modal's heading, and so its name. */
    title: string;
    subtitle?: string;
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
    /** The header's close button and the footer's Cancel. */
    onCancel: () => void;
    /** `.add-restaurant-form` or `.update-restaurant-form`, for what differs. */
    className: string;
    /** Create's cover-photo section, which edit has no use for. */
    children?: React.ReactNode;
}

type TextField = Exclude<keyof RestaurantFields, "price" | "description">;

export const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$", "$$$$$"];

/** What each price means, said under the picker and to a screen reader. */
const PRICE_MEANINGS: Record<string, string> = {
    "$": "Inexpensive",
    "$$": "Moderate",
    "$$$": "Pricey",
    "$$$$": "High-end",
    "$$$$$": "A splurge",
};

/** One titled group of fields. */
export function RestaurantFormSection({ title, hint, children }: {
    title: string;
    hint?: string;
    children: React.ReactNode;
}): React.JSX.Element {
    const id = useId();
    return (
        <section className="restaurant-form-section" aria-labelledby={id}>
            <div className="restaurant-form-section-heading">
                <h3 id={id}>{title}</h3>
                {hint && <p>{hint}</p>}
            </div>
            {children}
        </section>
    );
}

function RestaurantForm({
    title, subtitle, value, onChange, categoryIds, onCategoryIdsChange, amenityIds,
    onAmenityIdsChange, hours, onHoursChange, timezone, onTimezoneChange, required = false,
    errors, busy, submitLabel, busyLabel, onSubmit, onCancel, className, children,
}: RestaurantFormProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    const idPrefix = useId();
    const categories = useAppSelector((state) => state.categories.list);
    const amenities = useAppSelector((state) => state.categories.amenities);
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Two closed lists, shared by every form that offers them, so they are
        // fetched once and kept.
        if (categories.length === 0) dispatch(getCategories());
        if (amenities.length === 0) dispatch(getAmenities());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    useEffect(() => {
        // The list is at the top and Save is at the bottom, a long scroll
        // apart. Taking focus brings it into view, and a screen reader reads
        // it out as well as announcing the alert.
        if (errors.length > 0) errorRef.current?.focus();
    }, [errors]);

    const set = (name: keyof RestaurantFields) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [name]: event.target.value });

    const field = (name: TextField, label: string, options: {
        placeholder?: string;
        type?: "text" | "tel";
        wide?: boolean;
        maxLength?: number;
        /** Where the dialog puts focus when it opens, past the Close button. */
        autoFocus?: boolean;
    } = {}) => (
        <label className={`restaurant-form-field${options.wide ? " wide" : ""}`}>
            <span className="restaurant-form-label">{label}</span>
            <input
                type={options.type || "text"}
                value={value[name]}
                placeholder={options.placeholder}
                maxLength={options.maxLength}
                data-autofocus={options.autoFocus || undefined}
                onChange={set(name)}
                required={required}
            />
        </label>
    );

    return (
        <form className={`restaurant-form ${className}`} onSubmit={onSubmit}>
            <header className="restaurant-form-header">
                <div>
                    <h2 className="restaurant-form-title">{title}</h2>
                    {subtitle && <p className="restaurant-form-subtitle">{subtitle}</p>}
                </div>
                <button type="button" className="restaurant-form-close" onClick={onCancel} aria-label="Close">
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <div className="restaurant-form-body">
                {errors.length > 0 && (
                    <div className="error-container" role="alert" ref={errorRef} tabIndex={-1}>
                        <div className="error-header">
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                            Please fix the following:
                        </div>
                        <ul className="error-list">
                            {errors.map((error, index) => (
                                <li key={index} className="error-item">{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <RestaurantFormSection title="The basics" hint="What people see first, on the list and at the top of its page.">
                    <div className="restaurant-form-grid">
                        {field("name", "Business name", { wide: true, autoFocus: true })}

                        <fieldset className="restaurant-form-field wide restaurant-form-price">
                            <legend className="restaurant-form-label">Price range</legend>
                            <div className="price-options">
                                {PRICE_OPTIONS.map((price) => (
                                    <label key={price} className="price-option">
                                        <input
                                            type="radio"
                                            name={`${idPrefix}-price`}
                                            value={price}
                                            checked={value.price === price}
                                            onChange={set("price")}
                                            aria-label={`${price}, ${PRICE_MEANINGS[price]}`}
                                        />
                                        <span aria-hidden="true">{price}</span>
                                    </label>
                                ))}
                            </div>
                            <span className="restaurant-form-hint">{PRICE_MEANINGS[value.price] || ""}</span>
                        </fieldset>

                        {/* Not wrapped in its label like the others: the counter
                            would sit inside it and become part of the field's
                            name ("Description 0/500"). */}
                        <div className="restaurant-form-field wide">
                            <label className="restaurant-form-label" htmlFor={`${idPrefix}-description`}>Description</label>
                            <textarea
                                id={`${idPrefix}-description`}
                                value={value.description}
                                onChange={set("description")}
                                rows={4}
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                required={required}
                                placeholder="What makes it worth the trip?"
                                aria-describedby={`${idPrefix}-description-count`}
                            />
                            <span
                                id={`${idPrefix}-description-count`}
                                className={`description-count${value.description.length > MAX_DESCRIPTION_LENGTH - 50 ? " near-limit" : ""}`}
                            >
                                {value.description.length}/{MAX_DESCRIPTION_LENGTH}
                            </span>
                        </div>
                    </div>
                </RestaurantFormSection>

                <RestaurantFormSection title="Location" hint="Unless you pick a time zone under Opening hours, the state decides it.">
                    <div className="restaurant-form-grid">
                        {field("address", "Street address", { wide: true })}
                        {field("city", "City")}
                        {field("state", "State", { placeholder: "TX", maxLength: 2 })}
                        {field("zipcode", "ZIP code")}
                        {field("country", "Country", { placeholder: "USA" })}
                    </div>
                </RestaurantFormSection>

                <RestaurantFormSection title="Contact">
                    <div className="restaurant-form-grid">
                        {field("phone_number", "Phone", { type: "tel", placeholder: "(555) 123-4567" })}
                        {/* Not type="url": that makes the browser demand a
                            scheme, and the form accepts "example.com" on purpose. */}
                        {field("website", "Website", { placeholder: "example.com" })}
                    </div>
                </RestaurantFormSection>

                <RestaurantFormSection
                    title="Cuisines and amenities"
                    hint={`Up to ${MAX_CATEGORIES} cuisines, and anything it offers. People filter by both.`}
                >
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
                </RestaurantFormSection>

                <RestaurantFormSection
                    title="Opening hours"
                    hint="Tick the days it opens. A closing time before the opening one runs past midnight."
                >
                    <HoursEditor
                        title={null}
                        value={hours}
                        onChange={onHoursChange}
                        timezone={timezone}
                        onTimezoneChange={onTimezoneChange}
                    />
                </RestaurantFormSection>

                {children}
            </div>

            <footer className="restaurant-form-footer">
                <button type="button" className="restaurant-form-cancel" onClick={onCancel}>
                    Cancel
                </button>
                <button className="restaurant-form-submit" type="submit" disabled={busy}>
                    {busy ? busyLabel : submitLabel}
                </button>
            </footer>
        </form>
    );
}

export default RestaurantForm;
