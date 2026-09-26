import restaurantsReducer, { inOrder, loadRestaurants } from "./restaurants";
import { favoriteChanged } from "./favorites";

/**
 * The listing and the search results keep the order the API sent. The cards
 * live in maps keyed by id, and a map's values come back in ascending id
 * order, so the order has to be kept beside it (#106).
 */

const card = (id: number) => ({ id, name: `R${id}` } as any);
const page = (ids: number[], pageNumber = 1, total = 10) =>
  ({ items: ids.map(card), page: pageNumber, per_page: 20, total });
const names = (list: { name: string }[]) => list.map((restaurant) => restaurant.name);

const searched = (ids: number[], append = false, pageNumber = 1) => ({
  type: "restaurants/searchedRestaurants", restaurants: page(ids, pageNumber), append,
}) as any;

test("a page keeps the API's order, not the ids'", () => {
  const state = restaurantsReducer(undefined, loadRestaurants(page([9, 2, 5]), false) as any);

  expect(names(inOrder(state.allRestaurants, state.allRestaurantIds))).toEqual(["R9", "R2", "R5"]);
});

test("Show more adds the next page after the first, and a repeat keeps its first place", () => {
  let state = restaurantsReducer(undefined, loadRestaurants(page([9, 2, 5]), false) as any);
  // 2 again: something between the two requests moved the rest down a place.
  state = restaurantsReducer(state, loadRestaurants(page([2, 7, 1], 2), true) as any);

  expect(names(inOrder(state.allRestaurants, state.allRestaurantIds))).toEqual(["R9", "R2", "R5", "R7", "R1"]);
});

test("a new first page replaces the list rather than adding to it", () => {
  let state = restaurantsReducer(undefined, loadRestaurants(page([9, 2, 5]), false) as any);
  state = restaurantsReducer(state, loadRestaurants(page([4, 3]), false) as any);
  expect(names(inOrder(state.allRestaurants, state.allRestaurantIds))).toEqual(["R4", "R3"]);

  // The old order must be gone too, not just hidden: were it kept, 9 on the
  // new filter's second page would jump back to the top.
  state = restaurantsReducer(state, loadRestaurants(page([9], 2), true) as any);
  expect(names(inOrder(state.allRestaurants, state.allRestaurantIds))).toEqual(["R4", "R3", "R9"]);
});

test("search results keep their order, append after Show more, and empty on an error", () => {
  let state = restaurantsReducer(undefined, searched([8, 1, 6]));
  expect(names(inOrder(state.searchedRestaurants, state.searchedIds))).toEqual(["R8", "R1", "R6"]);

  state = restaurantsReducer(state, searched([3], true, 2));
  expect(names(inOrder(state.searchedRestaurants, state.searchedIds))).toEqual(["R8", "R1", "R6", "R3"]);

  state = restaurantsReducer(state, { type: "restaurants/searchError", error: "Nope" } as any);
  expect(inOrder(state.searchedRestaurants, state.searchedIds)).toEqual([]);
});

test("a saved heart still reaches a listed card", () => {
  let state = restaurantsReducer(undefined, loadRestaurants(page([9, 2]), false) as any);
  state = restaurantsReducer(state, favoriteChanged(2, true, false));

  const [, second] = inOrder(state.allRestaurants, state.allRestaurantIds);
  expect(second).toMatchObject({ id: 2, isFavorited: true });
});
