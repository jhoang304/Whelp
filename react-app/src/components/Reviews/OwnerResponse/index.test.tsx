import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import { ModalProvider, Modal } from "../../../context/Modal";
import OwnerResponse from "./index";

/**
 * The owner's reply under a review. A request that failed outright used to
 * leave the form on "Saving..." with Cancel disabled (#116).
 */

const review = {
  id: 4, user_id: 2, restaurant_id: 3, review: "Good.", rating: 4, createdAt: "", updatedAt: "",
  response: null as any,
};
const reply = { id: 8, review_id: 4, user_id: 1, response: "Thank you!", createdAt: "2026-01-01", updatedAt: "2026-01-01", user: null };

function renderReply(withResponse = false) {
  const store = createStore(combineReducers({ reviews: reviewReducer }), applyMiddleware(thunk));
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <OwnerResponse review={{ ...review, response: withResponse ? reply : null }} canManage businessName="Uchi" />
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
}

afterEach(() => {
  delete (global as any).fetch;
});

test("a reply that can't reach the server gives the form back, saying so", async () => {
  (global as any).fetch = jest.fn(() => Promise.reject(new TypeError("Failed to fetch")));
  renderReply();

  fireEvent.click(screen.getByRole("button", { name: /Respond to this review/ }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thanks for coming." } });
  fireEvent.click(screen.getByRole("button", { name: "Post response" }));

  expect(await screen.findByText("Couldn't reach the server. Check your connection and try again.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Post response" })).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
  expect(screen.getByRole("textbox")).toHaveValue("Thanks for coming.");
});

test("a refused delete of the reply stays in the dialog and says why", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: false, status: 403, json: () => Promise.resolve({ errors: ["Only the owner of this business can respond to its reviews"] }),
  }));
  renderReply(true);

  fireEvent.click(screen.getByRole("button", { name: "Delete your response" }));
  fireEvent.click(screen.getByRole("dialog").querySelector(".delete-button") as HTMLElement);

  expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner of this business can respond to its reviews");
  expect(screen.getByRole("dialog", { name: "Delete Response" })).toBeInTheDocument();
  expect(screen.getByText("Thank you!")).toBeInTheDocument();
});

test("a garbled answer to a reply still gives the form back", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 201, json: () => Promise.reject(new SyntaxError("Unexpected token <")),
  }));
  renderReply();

  fireEvent.click(screen.getByRole("button", { name: /Respond to this review/ }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thanks for coming." } });
  fireEvent.click(screen.getByRole("button", { name: "Post response" }));

  expect(await screen.findByText("Something went wrong saving your response. Please try again.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Post response" })).not.toBeDisabled();
});
