import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import categoriesReducer from "../../store/categories";
import RestaurantForm from "./index";
import { RestaurantFields } from "../../utils/restaurantValidation";

/**
 * The layout the two restaurant modals share: a heading, sections, a price
 * picker made of real radio buttons, and a footer that can cancel.
 */

const BLANK: RestaurantFields = {
  name: "", price: "$$", address: "", city: "", state: "", zipcode: "", country: "",
  phone_number: "", website: "", description: "",
};

function Harness({ errors = [], onCancel = () => {}, onChangeSpy }: {
  errors?: string[]; onCancel?: () => void; onChangeSpy?: (next: RestaurantFields) => void;
}) {
  const [value, setValue] = useState(BLANK);
  return (
    <RestaurantForm
      title="Add a restaurant"
      subtitle="Where it is."
      className="add-restaurant-form"
      value={value}
      onChange={(next) => { setValue(next); onChangeSpy?.(next); }}
      categoryIds={[]} onCategoryIdsChange={() => {}}
      amenityIds={[]} onAmenityIdsChange={() => {}}
      hours={[]} onHoursChange={() => {}}
      timezone={null} onTimezoneChange={() => {}}
      errors={errors}
      busy={false}
      submitLabel="Create Restaurant"
      busyLabel="Creating..."
      onSubmit={(event) => event.preventDefault()}
      onCancel={onCancel}
    />
  );
}

function renderForm(props: React.ComponentProps<typeof Harness> = {}) {
  // Categories and amenities already loaded, so the form fetches nothing.
  const store = createStore(
    combineReducers({ categories: categoriesReducer }),
    { categories: { list: [{ id: 1, name: "Italian", slug: "italian" }], amenities: [{ id: 1, name: "Free Wi-Fi", slug: "wifi" }] } } as any,
    applyMiddleware(thunk)
  );
  return render(<Provider store={store as any}><Harness {...props} /></Provider>);
}

test("it is headed, and grouped into named sections", () => {
  renderForm();
  expect(screen.getByRole("heading", { level: 2, name: "Add a restaurant" })).toBeInTheDocument();
  for (const name of ["The basics", "Location", "Contact", "Cuisines and amenities", "Opening hours"]) {
    expect(screen.getByRole("region", { name })).toBeInTheDocument();
  }
});

test("price is one choice of five, said in words as well as dollar signs", () => {
  const onChangeSpy = jest.fn();
  renderForm({ onChangeSpy });
  const group = screen.getByRole("group", { name: "Price range" });
  expect(group).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "$$, Moderate" })).toBeChecked();
  expect(screen.getByText("Moderate")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: "$$$$, High-end" }));

  expect(onChangeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ price: "$$$$" }));
  expect(screen.getByRole("radio", { name: "$$$$, High-end" })).toBeChecked();
  expect(screen.getByText("High-end")).toBeInTheDocument();
});

test("the close button and Cancel both cancel, and neither submits", () => {
  const onCancel = jest.fn();
  renderForm({ onCancel });

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onCancel).toHaveBeenCalledTimes(2);
});

test("errors are listed where the form starts, and take focus so they are seen", () => {
  const { rerender } = renderForm();
  const store = createStore(
    combineReducers({ categories: categoriesReducer }),
    { categories: { list: [], amenities: [] } } as any,
    applyMiddleware(thunk)
  );
  rerender(<Provider store={store as any}><Harness errors={["Name is required"]} /></Provider>);

  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("Name is required");
  expect(alert).toHaveFocus();
});

test("the state field takes two letters, as the rule wants", () => {
  renderForm();
  expect(screen.getByLabelText("State")).toHaveAttribute("maxLength", "2");
});
