import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import photoReducer from "../../store/restaurantPhoto";
import restaurantsReducer from "../../store/restaurants";
import { ModalProvider } from "../../context/Modal";
import DisplayPhotos from "./index";

/**
 * "See all photos". A load that failed used to leave "Loading..." up for
 * good, or show whichever restaurant's photos were in the store last (#116).
 * Remove deleted a photo for good on the first click, someone else's
 * included when the owner clicked it; now it asks first (#131).
 */

const restaurant: any = { id: 3, user_id: 1, name: "Uchi" };
const photo = (id: number, restaurantId: number) => ({
  id, restaurant_id: restaurantId, url: `https://img/${id}.jpg`, preview: false, createdByUserId: 1,
});
const ok = (body: any) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

function renderPhotos(storedPhotos: any[] = [], user: any = null, place: any = restaurant) {
  const store = createStore(
    combineReducers({ session: (state = { user }) => state, photos: photoReducer, Restaurants: restaurantsReducer }),
    { photos: { allRestaurantImages: Object.fromEntries(storedPhotos.map((p) => [p.id, p])) } } as any,
    applyMiddleware(thunk)
  );
  return render(
    <Provider store={store as any}>
      {/* It is always in a modal, and its close button closes that. */}
      <ModalProvider>
        <DisplayPhotos singleRestaurant={place} />
      </ModalProvider>
    </Provider>
  );
}

const shownPhotos = () =>
  Array.from(document.querySelectorAll(".indi-photo")).map((img) => img.getAttribute("src"));

afterEach(() => {
  delete (global as any).fetch;
});

test("a load that can't reach the server says so, and Try again loads them", async () => {
  const answers = [() => Promise.reject(new TypeError("Failed to fetch")), () => Promise.resolve(ok([photo(1, 3)]))];
  (global as any).fetch = jest.fn(() => answers.shift()!());
  renderPhotos();

  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(shownPhotos()).toEqual(["https://img/1.jpg"]));
});

test("another restaurant's photos left in the store are not shown as this one's", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ errors: ["boom"] }) }));
  renderPhotos([photo(7, 1), photo(8, 1)]);

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(shownPhotos()).toEqual([]);
});

test("only this restaurant's photos are listed, even alongside another's", async () => {
  (global as any).fetch = jest.fn(() => Promise.resolve(ok([photo(1, 3), photo(2, 3)])));
  renderPhotos([photo(7, 1)]);

  await waitFor(() => expect(shownPhotos()).toEqual(["https://img/1.jpg", "https://img/2.jpg"]));
});

// --- removing a photo (#131) -----------------------------------------------------

const OWNER = { id: 1, username: "owner" };

/**
 * The restaurant's photos, less any the server has since deleted. A DELETE
 * is answered by `remove`; the restaurant itself, reloaded for its cover,
 * with nothing much.
 */
function serve(photos: any[], remove: () => any = () => ok({ message: "Successfully deleted" })) {
  let current = photos;
  (global as any).fetch = jest.fn((url: string, options: any = {}) => {
    if (options.method === "DELETE") {
      const answer = remove();
      if (answer.ok) current = current.filter((p) => url !== `/api/restaurant-images/${p.id}`);
      return Promise.resolve(answer);
    }
    if (url === `/api/restaurant-images/${restaurant.id}/images`) return Promise.resolve(ok(current));
    return Promise.resolve(ok({}));
  });
}

const deletes = () => ((global as any).fetch as jest.Mock).mock.calls
  .filter(([, options]) => options?.method === "DELETE").map(([url]) => url);

/** The first photo's Remove, clicked with focus on it, as in a browser. */
async function askAboutFirst() {
  await waitFor(() => expect(shownPhotos()).toHaveLength(2));
  const remove = screen.getAllByRole("button", { name: "Remove" })[0];
  remove.focus();
  fireEvent.click(remove);
  return { remove, question: screen.getByRole("group", { name: "Remove this photo?" }) };
}

test("Remove asks first, over the photo it means, and sends nothing yet", async () => {
  serve([photo(1, 3), photo(2, 3)]);
  renderPhotos([], OWNER);
  const { remove, question } = await askAboutFirst();

  expect(question.closest(".photo-li")).toBe(remove.closest(".photo-li"));
  expect(within(question).getByRole("button", { name: "Cancel" })).toHaveFocus();
  expect(remove).toHaveAttribute("aria-expanded", "true");
  expect(deletes()).toEqual([]);
});

test("Cancel leaves the photo, and focus back on its Remove", async () => {
  serve([photo(1, 3), photo(2, 3)]);
  renderPhotos([], OWNER);
  const { remove, question } = await askAboutFirst();

  fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(remove).toHaveFocus();
  expect(remove).toHaveAttribute("aria-expanded", "false");
  expect(shownPhotos()).toEqual(["https://img/1.jpg", "https://img/2.jpg"]);
  expect(deletes()).toEqual([]);
});

test("answered, it removes the photo, says so, and moves focus on to the next one", async () => {
  serve([photo(1, 3), photo(2, 3)]);
  renderPhotos([], OWNER);
  const { question } = await askAboutFirst();

  fireEvent.click(within(question).getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(shownPhotos()).toEqual(["https://img/2.jpg"]));
  expect(deletes()).toEqual(["/api/restaurant-images/1"]);
  await waitFor(() => expect(screen.getByRole("button", { name: "Enlarge photo 1 of 1 of Uchi" })).toHaveFocus());
  expect(screen.getByRole("status")).toHaveTextContent("Photo removed.");
});

test("a removal the server refuses keeps the photo, and the question up to try again", async () => {
  serve([photo(1, 3), photo(2, 3)], () => ({
    ok: false, status: 403, json: () => Promise.resolve({ errors: ["Only the owner or the uploader can remove this photo"] }),
  }));
  renderPhotos([], OWNER);
  const { question } = await askAboutFirst();

  fireEvent.click(within(question).getByRole("button", { name: "Remove" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner or the uploader can remove this photo");
  expect(shownPhotos()).toHaveLength(2);
  expect(screen.getByRole("group", { name: "Remove this photo?" })).toBe(question);
  expect(within(question).getByRole("button", { name: "Remove" })).not.toHaveAttribute("aria-disabled");
});

test("an owner removing a photo someone else added is told so", async () => {
  // Their own, someone else's, and one from before uploaders were recorded.
  serve([photo(1, 3), { ...photo(2, 3), createdByUserId: 9 }, { ...photo(3, 3), createdByUserId: null }]);
  renderPhotos([], OWNER);
  await waitFor(() => expect(shownPhotos()).toHaveLength(3));
  const [own, theirs, unknown] = screen.getAllByRole("button", { name: "Remove" });

  fireEvent.click(own);
  expect(screen.getByRole("group")).toHaveTextContent("This can't be undone.");
  expect(screen.getByRole("group")).not.toHaveTextContent("Someone else");

  fireEvent.click(theirs);
  expect(screen.getAllByRole("group")).toHaveLength(1);
  expect(screen.getByRole("group")).toHaveTextContent("Someone else added it. This can't be undone.");

  // Not known to be anyone else's, so not said to be.
  fireEvent.click(unknown);
  expect(screen.getByRole("group")).not.toHaveTextContent("Someone else");
});

test("every card has its row of actions, buttons or none, so the cards end level", async () => {
  // Not the owner: their own photo has Remove, the owner's has nothing.
  serve([photo(1, 3), { ...photo(2, 3), createdByUserId: 5 }]);
  renderPhotos([], { id: 5, username: "visitor" });
  await waitFor(() => expect(shownPhotos()).toHaveLength(2));

  const rows = Array.from(document.querySelectorAll(".photo-li")).map((card) => card.querySelector(".photo-actions"));
  expect(rows.every(Boolean)).toBe(true);
  expect(rows.map((row) => row!.textContent)).toEqual(["", "Remove"]);
});

test("on a demo restaurant, its owner can remove only the photos it added itself (#136)", async () => {
  // Its own, someone else's, and a seeded one with no uploader on record.
  serve([photo(1, 3), { ...photo(2, 3), createdByUserId: 9 }, { ...photo(3, 3), createdByUserId: null }]);
  renderPhotos([], { ...OWNER, isDemo: true }, { ...restaurant, isDemoRestaurant: true });
  await waitFor(() => expect(shownPhotos()).toHaveLength(3));

  const rows = Array.from(document.querySelectorAll(".photo-li")).map((card) => card.querySelector(".photo-actions")!.textContent);
  // Set as cover on all of them still: choosing the cover is the owner's.
  expect(rows).toEqual(["Set as coverRemove", "Set as cover", "Set as cover"]);
});
