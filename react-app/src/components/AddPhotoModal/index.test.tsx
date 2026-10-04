import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import restaurantsReducer from "../../store/restaurants";
import AddPhotoModal from "./index";

/** A pasted photo link is held to what the API takes before it is sent (#114). */

vi.mock("../../context/Modal", () => ({
  useModal: () => ({ closeModal: vi.fn() }),
}));

function renderModal() {
  const store = createStore(
    combineReducers({ session: (state = { user: { id: 2 } }) => state, Restaurants: restaurantsReducer }),
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <AddPhotoModal restaurantId={3} />
    </Provider>
  );
}

afterEach(() => {
  delete (global as any).fetch;
});

test("a link longer than the API takes is refused without a request", async () => {
  (global as any).fetch = vi.fn();
  renderModal();

  fireEvent.click(screen.getByRole("button", { name: /paste a url/i }));
  fireEvent.change(screen.getByLabelText("Photo URL"), {
    target: { value: "https://cdn.example.com/" + "a".repeat(300) + ".jpg" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Photo" }));

  expect(await screen.findByText("Photo URL must be 255 characters or fewer.")).toBeInTheDocument();
  expect((global as any).fetch).not.toHaveBeenCalled();
});
