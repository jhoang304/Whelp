/**
 * The one set of restaurant field rules for the client, shared by the create
 * and edit modals so they cannot drift apart again. The limits mirror the
 * columns in `app/models/restaurant.py` and the validators in
 * `app/forms/restaurant_form.py`; the server remains the authority.
 */
import { isValidPostcode, POSTCODE_MESSAGE } from "./postcode";

export const MAX_NAME_LENGTH = 100;
export const MAX_ADDRESS_LENGTH = 100;
export const MAX_CITY_LENGTH = 50;
export const MAX_COUNTRY_LENGTH = 56;
export const MAX_PHONE_LENGTH = 20;
export const MAX_WEBSITE_LENGTH = 70;
export const MAX_DESCRIPTION_LENGTH = 500;

export interface RestaurantFields {
    name: string;
    price: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    phone_number: string;
    website: string;
    description: string;
}

/**
 * Every problem with the form, as messages ready to show. An empty array
 * means the fields are worth sending.
 *
 * The website rule deliberately only asks for a dot: the edit modal used to
 * require a trailing `.com`, which rejects seeded sites such as
 * https://runchickenrun.com/las-vegas/ and every .org, .net and .co, so
 * owners could not edit *any* field without also changing their website.
 */
export function validateRestaurant(fields: RestaurantFields): string[] {
    const {
        name, price, address, city, state, zipcode,
        country, phone_number, website, description,
    } = fields;

    const errors: string[] = [];

    // Required
    if (!name.trim()) errors.push("Restaurant name is required");
    if (!address.trim()) errors.push("Address is required");
    if (!city.trim()) errors.push("City is required");
    if (!state.trim()) errors.push("State is required");
    if (!zipcode.trim()) errors.push("Zip code is required");
    if (!country.trim()) errors.push("Country is required");
    if (!phone_number.trim()) errors.push("Phone number is required");
    if (!website.trim()) errors.push("Website is required");
    if (!description.trim()) errors.push("Description is required");

    // Length
    if (name.length > MAX_NAME_LENGTH) errors.push(`Restaurant name must be ${MAX_NAME_LENGTH} characters or less`);
    if (address.length > MAX_ADDRESS_LENGTH) errors.push(`Address must be ${MAX_ADDRESS_LENGTH} characters or less`);
    if (city.length > MAX_CITY_LENGTH) errors.push(`City must be ${MAX_CITY_LENGTH} characters or less`);
    if (country.length > MAX_COUNTRY_LENGTH) errors.push(`Country must be ${MAX_COUNTRY_LENGTH} characters or less`);
    if (phone_number.length > MAX_PHONE_LENGTH) errors.push(`Phone number must be ${MAX_PHONE_LENGTH} characters or less`);
    if (website.length > MAX_WEBSITE_LENGTH) errors.push(`Website must be ${MAX_WEBSITE_LENGTH} characters or less`);
    if (description.length > MAX_DESCRIPTION_LENGTH) errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);

    // Format
    if (state && state.length !== 2) errors.push("State must be exactly 2 characters (e.g., CA, NY)");
    if (zipcode && !isValidPostcode(zipcode)) errors.push(POSTCODE_MESSAGE);
    if (phone_number && !/^[\d\s\-()]+$/.test(phone_number)) errors.push("Phone number can only contain digits, spaces, hyphens, and parentheses");
    if (website && !website.includes(".")) errors.push("Please enter a valid website URL (e.g., example.com)");
    if (price && !/^\$+$/.test(price)) errors.push("Price range must be between $ and $$$$$");

    return errors;
}
