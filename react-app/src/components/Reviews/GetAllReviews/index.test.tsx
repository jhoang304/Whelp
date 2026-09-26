import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { MemoryRouter } from "react-router-dom";
import reviewReducer from "../../../store/reviews";
import restaurantsReducer from "../../../store/restaurants";
import { ModalProvider, Modal } from "../../../context/Modal";
import GetAllReviews from "./index";

/**
 * A review whose author deleted their account stays on the page -- it is part
 * of the rating -- but says so, and links to no profile.
 */

const review = (id: number, user: any) => ({
  id, user_id: user ? user.id : null, restaurant_id: 3, review: `Review ${id}`, rating: 4,
  createdAt: "2026-09-01T00:00:00", updatedAt: "2026-09-01T00:00:00", user, reviewImages: [],
  response: null,
});

test("an author who has left is 'Deleted user', with no link", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({
      items: [review(1, null), review(2, { id: 5, username: "rita", profile_image_url: null })],
      page: 1, per_page: 10, total: 2,
    }),
  }));
  const store = createStore(
    combineReducers({
      session: (state = { user: null }) => state,
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
    }),
    applyMiddleware(thunk)
  );
  render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <GetAllReviews restaurantId={3} />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );

  expect(await screen.findByText("Deleted user")).toBeInTheDocument();
  expect(screen.getByText("Deleted user").closest("a")).toBeNull();
  expect(screen.getByText("Review 1")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "rita" })).toHaveAttribute("href", "/users/get/5");
  expect(screen.queryByRole("link", { name: /null/ })).not.toBeInTheDocument();
  delete (global as any).fetch;
});

test("the author's Edit and Delete sit in the review's header, named for what they act on", async () => {
  const rita = { id: 5, username: "rita", profile_image_url: null };
  (global as any).fetch = jest.fn(() => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({
      items: [review(1, rita), review(2, { id: 6, username: "sam", profile_image_url: null })],
      page: 1, per_page: 10, total: 2,
    }),
  }));
  const store = createStore(
    combineReducers({
      session: (state = { user: rita }) => state,
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
    }),
    applyMiddleware(thunk)
  );
  render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <GetAllReviews restaurantId={3} />
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );

  const edit = await screen.findByRole("button", { name: "Edit your review" });
  const del = screen.getByRole("button", { name: "Delete your review" });
  // Only on rita's own review, and in its header row with her name.
  expect(screen.getAllByRole("button", { name: /your review/ })).toHaveLength(2);
  expect(edit.closest(".review-user-data")).toHaveTextContent("rita");
  expect(edit.closest(".row-actions")).toBe(del.closest(".row-actions"));

  fireEvent.click(del);
  expect(screen.getByRole("dialog", { name: "Delete Review" })).toBeInTheDocument();
  delete (global as any).fetch;
});
