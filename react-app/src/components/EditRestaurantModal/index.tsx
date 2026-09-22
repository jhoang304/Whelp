import "./EditRestaurant.css"
import React, { useState } from "react";
import { useModal } from "../../context/Modal";
import { updateRestaurantThunk } from "../../store/restaurants"
import { useAppDispatch, useAppSelector } from "../../store";
import { SingleRestaurantResponse } from "../../types";
import { RestaurantFields, validateRestaurant } from "../../utils/restaurantValidation";
import RestaurantForm from "../RestaurantForm";

type EditableRestaurant = Pick<SingleRestaurantResponse,
    "id" | "user_id" | "name" | "price" | "address" | "city" | "state" |
    "zipcode" | "country" | "phone_number" | "website" | "description"> &
    Partial<Pick<SingleRestaurantResponse, "categories">>;

interface EditRestaurantProps {
    singleRestaurant: EditableRestaurant;
}

export default function EditRestaurant({ singleRestaurant }: EditRestaurantProps): React.JSX.Element {
    const dispatch = useAppDispatch();
    // Declared before handleUpdate rather than after it: the handler reads it,
    // and the old file only got away with that because of closure timing.
    const sessionUser = useAppSelector((rootState) => rootState.session.user);

    const [fields, setFields] = useState<RestaurantFields>({
        name: singleRestaurant.name,
        price: singleRestaurant.price,
        address: singleRestaurant.address,
        city: singleRestaurant.city,
        state: singleRestaurant.state,
        // Zipcodes are text now, but one loaded from an older payload can
        // still arrive as a number.
        zipcode: String(singleRestaurant.zipcode ?? ""),
        country: singleRestaurant.country,
        phone_number: singleRestaurant.phone_number,
        website: singleRestaurant.website,
        description: singleRestaurant.description,
    });
    const [categoryIds, setCategoryIds] = useState<number[]>(
        (singleRestaurant.categories || []).map((category) => category.id))
    const [errors, setErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const { closeModal } = useModal();

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const validationErrors = validateRestaurant(fields);

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors([]);
        setIsSaving(true);

        // The thunk returns the server's messages instead of throwing, so a
        // rejected save (400, or a 403 from someone who no longer owns the
        // business) is shown here. The modal used to close before the PUT had
        // even resolved, and its .catch could never fire. The catch below is
        // the backstop for anything the thunk cannot turn into messages, such
        // as a 200 whose body is not JSON: without it the modal would sit on
        // "Saving..." for good.
        let failures: string[] | null;
        try {
            failures = await dispatch(updateRestaurantThunk({
                ...fields,
                zipcode: fields.zipcode.trim(),
                id: singleRestaurant.id,
                // The server keeps the existing owner; never try to reassign it.
                user_id: singleRestaurant.user_id,
                category_ids: categoryIds,
            }));
        } catch (unexpected) {
            failures = ["Something went wrong saving your changes. Please try again."];
        }

        // Reset before closing rather than in a `finally`: closeModal unmounts
        // this component, so a reset after it would set state on an unmounted
        // one. Every path that leaves the modal open lands here first.
        setIsSaving(false);

        if (failures) {
            setErrors(failures);
            return;
        }

        closeModal();
    }

    let sessionLinks;

    if (sessionUser) {
        const currentUserId = sessionUser.id
        const restaurantOwnerId = singleRestaurant.user_id
        if (currentUserId === restaurantOwnerId) {
            sessionLinks = (
                <RestaurantForm
                    className="update-restaurant-form"
                    labels="inline"
                    value={fields}
                    onChange={setFields}
                    categoryIds={categoryIds}
                    onCategoryIdsChange={setCategoryIds}
                    errors={errors}
                    busy={isSaving}
                    submitLabel="Submit"
                    busyLabel="Saving..."
                    onSubmit={handleUpdate}
                />
            )
        } else if ((currentUserId !== restaurantOwnerId)) {
            sessionLinks = (
                <p>You are not the owner</p>
            )
        }
    } else {
        sessionLinks = (
            <div>
                Please log in to update the restaurant
            </div>
        )
    }
    return (
        <>
            <h2 className="edit-restaurant-text">Edit Restaurant</h2>
            {sessionLinks}
        </>
    )
}
