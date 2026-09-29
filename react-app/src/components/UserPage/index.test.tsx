import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import { useLayoutEffect } from "react";
import { MemoryRouter, Route, useLocation } from "react-router-dom";
import userProfileReducer from "../../store/userProfile";
import reviewReducer from "../../store/reviews";
import restaurantsReducer from "../../store/restaurants";
import { ModalProvider } from "../../context/Modal";
import { deferredFetch, ok, refused } from "../../testUtils/deferredFetch";
import UserProfilePage from "./index";

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

function renderProfiles() {
  painted = [];
  const server = deferredFetch();
  const store = createStore(
    combineReducers({
      session: (state = { user: null }) => state,
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
