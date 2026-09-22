import { AnyAction } from 'redux';

import { CategoriesState, Category } from '../types';
import { AppDispatch } from './index';

/**
 * The taxonomy, and the cities restaurants are in: two closed lists the filter
 * bar and the restaurant forms offer, rather than free text nobody can spell
 * the same way twice.
 */

/** What a restaurant may claim. Enforced by the API; repeated here so the
 * picker can stop counting rather than let the save fail. */
export const MAX_CATEGORIES = 3;

const LOAD_CATEGORIES = 'categories/loadCategories';
const LOAD_CITIES = 'categories/loadCities';

const loadCategories = (categories: Category[]) => ({
    type: LOAD_CATEGORIES,
    categories,
});

const loadCities = (cities: string[]) => ({
    type: LOAD_CITIES,
    cities,
});

/**
 * Both of these decorate a page rather than make it: a filter bar with no
 * cuisines in it is still a filter bar, so a failure here is swallowed and
 * the list stays empty instead of taking the page down with it.
 */
async function listFrom<T>(url: string): Promise<T[] | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const body = await response.json();
        return Array.isArray(body?.items) ? (body.items as T[]) : null;
    } catch (unreachable) {
        return null;
    }
}

export const getCategories = () => async (dispatch: AppDispatch) => {
    const items = await listFrom<Category>('/api/categories/');
    if (items) dispatch(loadCategories(items));
    return items;
};

export const getCities = () => async (dispatch: AppDispatch) => {
    const items = await listFrom<string>('/api/restaurants/cities');
    if (items) dispatch(loadCities(items));
    return items;
};

const initialState: CategoriesState = { list: [], cities: [] };

export default function categoriesReducer(
    state: CategoriesState = initialState,
    incoming: AnyAction,
): CategoriesState {
    switch (incoming.type) {
        case LOAD_CATEGORIES:
            return { ...state, list: incoming.categories };
        case LOAD_CITIES:
            return { ...state, cities: incoming.cities };
        default:
            return state;
    }
}
