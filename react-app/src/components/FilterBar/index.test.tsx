import { render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import categoriesReducer from "../../store/categories";
import FilterBar from "./index";
import { NO_FILTERS } from "../../utils/filters";

/**
 * The cities are asked for every time a list opens (#128): a restaurant in a
 * new city, or the last one in a city deleted, changes them, and the filter
 * didn't know until a reload. The cuisines are fixed, and fetched once.
 */

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

function renderBar(fetchCities: () => Promise<unknown>) {
  (global as any).fetch = jest.fn((url: string) =>
    url.startsWith("/api/restaurants/cities") ? fetchCities() : Promise.resolve(ok({ items: [] })));
  const store = createStore(
    combineReducers({ categories: categoriesReducer }),
    { categories: { list: [{ id: 1, name: "Italian", slug: "italian" }], cities: ["Houston"], amenities: [] } } as any,
    applyMiddleware(thunk)
  );
  render(
    <Provider store={store as any}>
      <FilterBar filters={NO_FILTERS} onChange={() => undefined} />
    </Provider>
  );
}

const cityOptions = () =>
  within(screen.getByLabelText("City")).getAllByRole("option").map((option) => option.textContent);

afterEach(() => {
  delete (global as any).fetch;
});

test("the cities are asked for again, though some are already known", async () => {
  renderBar(() => Promise.resolve(ok({ items: ["Austin", "Houston"] })));

  // What was known shows at once, and the new list replaces it.
  expect(cityOptions()).toEqual(["Anywhere", "Houston"]);
  await waitFor(() => expect(cityOptions()).toEqual(["Anywhere", "Austin", "Houston"]));
});

test("the cuisines, already known, are not asked for again", async () => {
  renderBar(() => Promise.resolve(ok({ items: ["Houston"] })));

  await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
  const urls = ((global as any).fetch as jest.Mock).mock.calls.map(([url]) => url);
  expect(urls.some((url: string) => url.startsWith("/api/categories"))).toBe(false);
});

test("a request that fails keeps the cities already known", async () => {
  renderBar(() => Promise.reject(new TypeError("Failed to fetch")));

  await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
  expect(cityOptions()).toEqual(["Anywhere", "Houston"]);
});
