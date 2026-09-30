import { act, render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { useLayoutEffect } from "react";
import { MemoryRouter, Route, useLocation } from "react-router-dom";
import userProfileReducer from "../../store/userProfile";
import reviewReducer from "../../store/reviews";
import restaurantsReducer from "../../store/restaurants";
import { ModalProvider, Modal } from "../../context/Modal";
import { deferredFetch, ok, refused } from "../../testUtils/deferredFetch";
import UserProfilePage from "./index";
import { axe } from "../../testUtils/axe";

/**
 * Going from one profile to another before the first has loaded leaves two
 * requests in flight. The page shows the one its URL names, whichever
 * answers last (#115).
 */

const profile = (id: number, name: string) => ({
  id, username: name.toLowerCase(), first_name: name, last_name: "", profile_image_url: null,
  createdAt: "2025-01-01T00:00:00", restaurants: [], restaurant_count: 0, review_count: 0,
});

/**
 * What the page showed at each commit, before its own effects ran: after a
 * navigation that is the frame a browser paints before the page's effect has
 * had a chance to say "loading".
 */
let painted: string[] = [];
function Probe() {
  const location = useLocation();
  useLayoutEffect(() => {
    painted.push(`${location.pathname}: ${document.querySelector("h1")?.textContent ?? "(no name)"}`);
  });
  return null;
}

function renderProfiles(signedIn: any = null) {
  painted = [];
  const server = deferredFetch();
  const store = createStore(
    combineReducers({
      session: (state = { user: signedIn }) => state,
      user: userProfileReducer,
      reviews: reviewReducer,
      Restaurants: restaurantsReducer,
    }),
    applyMiddleware(thunk)
  );
  let history: any;
  render(
    <Provider store={store as any}>
      <ModalProvider>
        <MemoryRouter initialEntries={["/users/get/1"]}>
          <Route path="/users/get/:userId"><UserProfilePage /></Route>
          <Probe />
          <Modal />
          <Route path="*" render={(props) => { history = props.history; return null; }} />
        </MemoryRouter>
      </ModalProvider>
    </Provider>
  );
  return { server, history: () => history };
}

/** Answer both of a profile's requests, the profile itself and its reviews. */
function answerProfile(server: ReturnType<typeof deferredFetch>, id: number, response: unknown) {
  server.answer((url) => url === `/api/users/get/${id}`, response);
  server.answer((url) => url === `/api/users/${id}/reviews`, ok([]));
}

afterEach(() => {
  delete (global as any).fetch;
});

test("the profile the URL names is shown, even when the one before answers last", async () => {
  const { server, history } = renderProfiles();
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  act(() => { history().push("/users/get/2"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(4));

  await act(async () => answerProfile(server, 2, ok(profile(2, "Bea"))));
  await act(async () => answerProfile(server, 1, ok(profile(1, "Al"))));

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bea");
});

test("the one before failing late doesn't turn this one into 'not found'", async () => {
  const { server, history } = renderProfiles();
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  act(() => { history().push("/users/get/2"); });
  await waitFor(() => expect(server.waiting()).toHaveLength(4));

  await act(async () => answerProfile(server, 2, ok(profile(2, "Bea"))));
  await act(async () => answerProfile(server, 1, refused(404, ["User couldn't be found"])));

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bea");
  expect(screen.queryByText("We couldn't find that user.")).not.toBeInTheDocument();
});

test("the previous profile is never shown under the next one's URL, even for a moment", async () => {
  const { server, history } = renderProfiles();
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  await act(async () => answerProfile(server, 1, ok(profile(1, "Al"))));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Al");

  act(() => { history().push("/users/get/2"); });

  expect(painted.filter((frame) => frame.startsWith("/users/get/2"))).not.toContain("/users/get/2: Al");
  expect(screen.getByText("Loading profile...")).toBeInTheDocument();
});

// --- requests that fail (#116) -------------------------------------------------------

test("a profile that can't reach the server says so, instead of loading for good", async () => {
  const { server } = renderProfiles();
  await waitFor(() => expect(server.waiting()).toHaveLength(2));

  await act(async () => {
    server.drop((url) => url === "/api/users/get/1");
    server.answer((url) => url === "/api/users/1/reviews", ok([]));
  });

  expect(screen.queryByText("Loading profile...")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Couldn't reach the server. Check your connection and try again." })).toBeInTheDocument();
});

test("a refused delete of a review on your profile keeps it, and the dialog says why", async () => {
  const { server } = renderProfiles({ id: 1, username: "al" });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  const yours = {
    id: 40, user_id: 1, restaurant_id: 3, review: "Worth the wait.", rating: 5,
    createdAt: "2026-01-01T00:00:00", updatedAt: "2026-01-01T00:00:00",
    restaurant: { id: 3, name: "Uchi" }, reviewImages: [], response: null,
  };
  await act(async () => {
    server.answer((url) => url === "/api/users/get/1", ok(profile(1, "Al")));
    server.answer((url) => url === "/api/users/1/reviews", ok([yours]));
  });

  fireEvent.click(screen.getByRole("button", { name: "Delete your review of Uchi" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Review" }));
  await act(async () => server.answer((url) => url === "/api/reviews/40", refused(403, ["You can only delete your own reviews"])));

  expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("You can only delete your own reviews");
  expect(screen.getByText("Worth the wait.")).toBeInTheDocument();
});

// --- what a screen reader and a keyboard get (#122) ---------------------------------

test("your own profile has nothing axe objects to, and Edit is a link to the edit page", async () => {
  const { server } = renderProfiles({ id: 1, username: "al" });
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  const yours = {
    id: 40, user_id: 1, restaurant_id: 3, review: "Worth the wait.", rating: 5,
    createdAt: "2026-01-01T00:00:00", updatedAt: "2026-01-01T00:00:00",
    restaurant: { id: 3, name: "Uchi", city: "Houston", state: "TX" }, reviewImages: [], response: null,
  };
  await act(async () => {
    server.answer((url) => url === "/api/users/get/1", ok(profile(1, "Al")));
    server.answer((url) => url === "/api/users/1/reviews", ok([yours]));
  });

  // It goes to a page, so it opens in a new tab like a link.
  expect(screen.getByRole("link", { name: "Edit your review of Uchi" })).toHaveAttribute("href", "/3/reviews/40/update");
  expect(await axe(document.body)).toHaveNoViolations();
});

test("a profile that isn't there says so as the page's heading", async () => {
  const { server } = renderProfiles();
  await waitFor(() => expect(server.waiting()).toHaveLength(2));
  await act(async () => {
    server.answer((url) => url === "/api/users/get/1", refused(404, ["User not found"]));
    server.answer((url) => url === "/api/users/1/reviews", refused(404, ["User not found"]));
  });
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});
