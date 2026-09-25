import restaurantsReducer from "./restaurants";
import userProfileReducer from "./userProfile";
import { favoriteChanged } from "./favorites";

/**
 * One save, every copy: the listing, the search results and the detail page
 * each hold their own copy of a restaurant, and all of them change together.
 * The profile's Saved count moves only when the flag really did.
 */

const card = (id: number, isFavorited = false) => ({ id, name: `R${id}`, isFavorited } as any);

test("the listing, the search results and the open detail page all take the new flag", () => {
  const state = {
    allRestaurants: { 1: card(1), 2: card(2) },
    searchedRestaurants: { 1: card(1) },
    singleRestaurant: { id: 1, name: "R1", isFavorited: false } as any,
  };

  const next = restaurantsReducer(state as any, favoriteChanged(1, true, false));

  expect(next.allRestaurants![1].isFavorited).toBe(true);
  expect(next.allRestaurants![2].isFavorited).toBe(false);
  expect(next.searchedRestaurants![1].isFavorited).toBe(true);
  expect(next.singleRestaurant!.isFavorited).toBe(true);
});

test("a restaurant the store does not hold is left out, not invented", () => {
  const state = { allRestaurants: { 1: card(1) }, singleRestaurant: { id: 1 } as any };

  const next = restaurantsReducer(state as any, favoriteChanged(9, true, false));

  expect(Object.keys(next.allRestaurants!)).toEqual(["1"]);
  expect(next.singleRestaurant!.isFavorited).toBeUndefined();
});

test("the Saved count moves by one when the flag changes, and not when it does not", () => {
  const own = { profile: { id: 3, restaurants: [], favorite_count: 2 } as any, reviews: [] };

  expect(userProfileReducer(own, favoriteChanged(1, true, false)).profile!.favorite_count).toBe(3);
  expect(userProfileReducer(own, favoriteChanged(1, false, true)).profile!.favorite_count).toBe(1);
  // Saving what was already saved -- a double click -- is not another save.
  expect(userProfileReducer(own, favoriteChanged(1, true, true)).profile!.favorite_count).toBe(2);
});

test("someone else's profile has no count to move", () => {
  const theirs = { profile: { id: 4, restaurants: [card(1)] } as any, reviews: [] };

  const next = userProfileReducer(theirs, favoriteChanged(1, true, false));

  expect(next.profile!.favorite_count).toBeUndefined();
  expect(next.profile!.restaurants[0].isFavorited).toBe(true);
});
