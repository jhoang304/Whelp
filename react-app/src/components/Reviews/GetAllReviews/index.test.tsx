import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

// --- more than one page of reviews (#113) ----------------------------------------

const VIEWER = { id: 50, username: "viewer", profile_image_url: null };

/**
 * A restaurant with `count` reviews, newest first, served the way the API
 * pages them: `offset` and `per_page` off the query string, and with
 * `mine=first` the viewer's own review ahead of the rest. The viewer wrote
 * the one at index `mine`, if any. Deleting one takes it off the list.
 */
function serveReviews(count: number, mine: number | null = null) {
  let list = Array.from({ length: count }, (_, index) => {
    const author = index === mine ? VIEWER : { id: 100 + index, username: `critic${index}`, profile_image_url: null };
    return review(1000 - index, author);
  });
  const requests: string[] = [];
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    requests.push(`${options.method ?? "GET"} ${url}`);
    if (options.method === "DELETE") {
      const id = Number(url.split("/").pop());
      list = list.filter((item) => item.id !== id);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: ["Successfully deleted"] }) });
    }
    if (url.startsWith("/api/restaurants/3/reviews")) {
      const query = new URLSearchParams(url.split("?")[1]);
      const offset = Number(query.get("offset"));
      const perPage = Number(query.get("per_page"));
      const isMine = (item: any) => item.user_id === VIEWER.id;
      const ordered = query.get("mine") === "first"
        ? [...list.filter(isMine), ...list.filter((item) => !isMine(item))]
        : list;
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({
          items: ordered.slice(offset, offset + perPage), page: 1, per_page: perPage, offset, total: list.length,
        }),
      });
    }
    const viewerReviewId = list.find((item) => item.user_id === VIEWER.id)?.id ?? null;
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ id: 3, user_id: 1, name: "Uchi", restaurantImages: [], categories: [], viewerReviewId }),
    });
  });
  return {
    requests,
    ids: () => list.map((item) => item.id),
    // Someone else posts one: the newest, so it goes on top.
    post: (id: number) => list.unshift(review(id, { id: 900, username: "newcomer", profile_image_url: null })),
  };
}

function renderReviews(viewerReviewId: number | null, user: any = VIEWER) {
  const store = createStore(
    combineReducers({
      session: (state = { user }) => state,
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
    }),
    { Restaurants: { singleRestaurant: { id: 3, user_id: 1, name: "Uchi", viewerReviewId } } } as any,
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      <MemoryRouter>
        <ModalProvider>
          <GetAllReviews restaurantId={3} />
          <Modal />
        </ModalProvider>
      </MemoryRouter>
    </Provider>
  );
}

const shownIds = () =>
  Array.from(document.querySelectorAll(".review-body")).map((node) => Number(node.textContent!.replace("Review ", "")));

afterEach(() => {
  delete (global as any).fetch;
});

test("past twenty reviews, Show more brings the rest, once each, and then goes", async () => {
  const server = serveReviews(25);
  renderReviews(null);

  fireEvent.click(await screen.findByRole("button", { name: "Show more reviews (20 of 25)" }));

  await waitFor(() => expect(shownIds()).toHaveLength(25));
  expect(shownIds()).toEqual(server.ids());
  expect(screen.queryByRole("button", { name: /Show more|Loading/ })).not.toBeInTheDocument();
  expect(server.requests).toContain("GET /api/restaurants/3/reviews?sort=newest&mine=first&offset=20&per_page=20");
});

test("twenty or fewer, there is nothing to show more of", async () => {
  serveReviews(20);
  renderReviews(null);

  await waitFor(() => expect(shownIds()).toHaveLength(20));
  expect(screen.queryByRole("button", { name: /Show more|Loading/ })).not.toBeInTheDocument();
});

test("a review posted meanwhile shows no review twice, and the button still ends", async () => {
  const server = serveReviews(25);
  renderReviews(null);
  await waitFor(() => expect(shownIds()).toHaveLength(20));

  server.post(2000);
  fireEvent.click(screen.getByRole("button", { name: "Show more reviews (20 of 25)" }));
  await waitFor(() => expect(shownIds()).toHaveLength(25));
  expect(new Set(shownIds()).size).toBe(25);

  // The new one is counted but sits above the reviews shown: the next click
  // brings nothing new, and that is the end.
  fireEvent.click(screen.getByRole("button", { name: "Show more reviews (25 of 26)" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /Show more|Loading/ })).not.toBeInTheDocument());
  expect(shownIds()).toHaveLength(25);
});

test("your review comes first, set apart, even when it is the oldest", async () => {
  const server = serveReviews(25, 22);
  const mine = server.ids()[22];
  renderReviews(mine);

  await waitFor(() => expect(shownIds()).toHaveLength(20));
  expect(shownIds()[0]).toBe(mine);
  const yours = screen.getByText("Your review").closest(".single-review-container")!;
  expect(yours).toHaveClass("your-review");
  expect(within(yours as HTMLElement).getByRole("button", { name: "Edit your review" })).toBeInTheDocument();
  expect(screen.getAllByText("Your review")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Write a review" })).not.toBeInTheDocument();

  // And it isn't shown a second time further down.
  fireEvent.click(screen.getByRole("button", { name: "Show more reviews (20 of 25)" }));
  await waitFor(() => expect(shownIds()).toHaveLength(25));
  expect(shownIds().filter((id) => id === mine)).toHaveLength(1);
});

test("someone who hasn't reviewed it may write one", async () => {
  serveReviews(25);
  renderReviews(null);

  expect(await screen.findByRole("link", { name: "Write a review" })).toHaveAttribute("href", "/3/create-review");
  expect(screen.queryByRole("link", { name: "Edit your review" })).not.toBeInTheDocument();
});

test("Write a review sits in the heading, ahead of the reviews rather than after them all", async () => {
  serveReviews(25);
  renderReviews(null);
  await waitFor(() => expect(shownIds()).toHaveLength(20));

  const write = screen.getByRole("link", { name: "Write a review" });
  expect(write.closest(".reviews-heading")).not.toBeNull();
  const firstReview = document.querySelector(".single-review-container")!;
  expect(write.compareDocumentPosition(firstReview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("with no reviews yet, Write a review is still offered", async () => {
  serveReviews(0);
  renderReviews(null);

  expect(await screen.findByText(/No reviews yet/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Write a review" })).toBeInTheDocument();
});

test("deleting your review, then Show more, skips nobody", async () => {
  const server = serveReviews(25, 3);
  const mine = server.ids()[3];
  renderReviews(mine);

  fireEvent.click(await screen.findByRole("button", { name: "Delete your review" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Review" }));

  await waitFor(() => expect(shownIds()).not.toContain(mine));
  expect(await screen.findByRole("link", { name: "Write a review" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show more reviews (19 of 24)" }));

  await waitFor(() => expect(shownIds()).toHaveLength(24));
  expect(shownIds()).toEqual(server.ids());
  expect(server.requests).toContain("GET /api/restaurants/3/reviews?sort=newest&mine=first&offset=19&per_page=20");
});

test("a Show more that answers after the sort changed is dropped", async () => {
  serveReviews(25);
  const realFetch = (global as any).fetch;
  let releaseLate: () => void = () => {};
  (global as any).fetch = jest.fn((url: string, options: any) => {
    if (url.includes("sort=newest&offset=20")) {
      return new Promise((resolve) => { releaseLate = () => resolve(realFetch(url, options)); });
    }
    return realFetch(url, options);
  });
  renderReviews(null);

  fireEvent.click(await screen.findByRole("button", { name: "Show more reviews (20 of 25)" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "highest" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Show more reviews (20 of 25)" })).not.toBeDisabled());

  await act(async () => {
    releaseLate();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(shownIds()).toHaveLength(20);
});

test("the list doesn't say there are no reviews before they have arrived", async () => {
  let release: () => void = () => {};
  serveReviews(25);
  const realFetch = (global as any).fetch;
  (global as any).fetch = jest.fn((url: string, options: any) =>
    new Promise((resolve) => { release = () => resolve(realFetch(url, options)); }));
  renderReviews(null);

  expect(screen.queryByText(/No reviews yet/)).not.toBeInTheDocument();

  release();
  await waitFor(() => expect(shownIds()).toHaveLength(20));
  expect(screen.queryByText(/No reviews yet/)).not.toBeInTheDocument();
});

test("with no reviews at all, it says so", async () => {
  serveReviews(0);
  renderReviews(null);

  expect(await screen.findByText(/No reviews yet/)).toBeInTheDocument();
});
