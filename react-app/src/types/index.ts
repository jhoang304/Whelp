// API Response Types

/** One cuisine or kind of place, from the taxonomy at /api/categories. */
export interface Category {
  id: number;
  name: string;
  /** what a URL carries: ?category=breakfast-brunch */
  slug: string;
}

/** One thing a restaurant offers, from the list at /api/amenities. */
export interface Amenity {
  id: number;
  name: string;
  slug: string;
}

/** A day a restaurant opens. A weekday with no entry is a day it is closed. */
export interface OpeningHours {
  /** 0 is Monday, as in Python's date.weekday() */
  weekday: number;
  /** "HH:MM" */
  opens: string;
  closes: string;
}

/**
 * Whether a restaurant is open, worked out by the API against the clock where
 * the restaurant is. Null means it has no hours or no timezone -- "nobody has
 * said", which is not "closed" and must not be shown as one.
 */
export type OpenStatus =
  | { isOpen: true; until: string }
  | { isOpen: false; opensAt?: string; opensWeekday?: number; opensDay?: string }
  | null;

export interface Restaurant {
  id: number;
  user_id: number;
  name: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  phone_number: string;
  description: string;
  website: string;
  avgRating: number;
  numReviews?: number;
  previewImage: string | null;
  oneReview?: string | null;
  categories?: Category[];
  amenities?: Amenity[];
  openStatus?: OpenStatus;
  /** Whether the reader has saved it; always false for someone logged out. */
  isFavorited?: boolean;
}

export interface RestaurantImage {
  id: number;
  restaurant_id: number;
  url: string;
  preview: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
}

export interface ReviewImage {
  id: number;
  review_id: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string | null;
  createdAt?: string;
}

/** Public subset of a user, as embedded in reviews and responses. */
export type PublicUser = Pick<User, 'id' | 'username' | 'first_name' | 'last_name' | 'profile_image_url' | 'createdAt'>;

/** A business owner's reply to a review. At most one per review. */
export interface ReviewResponse {
  id: number;
  review_id: number;
  user_id: number;
  response: string;
  createdAt: string;
  updatedAt: string;
  user: PublicUser | null;
}

/** Restaurant data embedded in a review payload. */
export type ReviewRestaurant = Omit<Restaurant, 'avgRating' | 'previewImage' | 'oneReview'> & {
  previewImage?: string | null;
};

export interface Review {
  id: number;
  /** Null once the author has deleted their account: "Deleted user". */
  user_id: number | null;
  restaurant_id: number;
  review: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  user?: PublicUser | null;
  reviewImages?: ReviewImage[];
  restaurant?: ReviewRestaurant | null;
  response?: ReviewResponse | null;
}

/** Payload of GET /api/users/get/:id */
export interface UserProfile extends PublicUser {
  email?: string; // only present when viewing your own profile
  restaurants: Restaurant[];
  restaurant_count: number;
  review_count: number;
  /** Only on your own profile: nobody else is told how many you have saved. */
  favorite_count?: number;
}

// API Response Containers

/** Every paginated list answers with this. */
export interface Page<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export type RestaurantsResponse = Page<Restaurant>;

export interface SingleRestaurantResponse {
  id: number;
  user_id: number;
  name: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  phone_number: string;
  description: string;
  website: string;
  User: {
    id: number;
    firstName: string;
    lastName: string;
  };
  restaurantImages: RestaurantImage[];
  numReviews: number;
  avgStarRating: number;
  categories: Category[];
  amenities: Amenity[];
  hours: OpeningHours[];
  openStatus: OpenStatus;
  timezone: string | null;
  isFavorited?: boolean;
}

// Redux State Types
export interface SessionState {
  user: User | null;
}

export interface RestaurantsState {
  allRestaurants?: { [key: number]: Restaurant };
  /** How many restaurants exist, so the page knows if there are more. */
  totalRestaurants?: number;
  loadedPage?: number;
  singleRestaurant?: SingleRestaurantResponse;
  searchedRestaurants?: { [key: number]: Restaurant };
  totalSearched?: number;
  searchedPage?: number;
  searchLoading?: boolean;
  searchError?: string | null;
  /** why the last listing request came back empty-handed, if it did */
  listError?: string | null;
}

/** The closed lists the filter bar and the restaurant form pick from. */
export interface CategoriesState {
  list: Category[];
  /** the cities with a restaurant in them, for the city filter */
  cities: string[];
  amenities: Amenity[];
}

export interface PhotosState {
  allRestaurantImages?: { [id: number]: RestaurantImage };
}

export interface ReviewsState {
  [reviewId: string]: Review;
}

export interface UserProfileState {
  profile: UserProfile | null;
  reviews: Review[];
}

export interface RootState {
  session: SessionState;
  Restaurants: RestaurantsState;
  categories: CategoriesState;
  photos: PhotosState;
  reviews: ReviewsState;
  user: UserProfileState;
}

// Component Props Types
export interface RestaurantProps {
  restaurant: Restaurant;
}

export interface RatingStarProps {
  rating: number;
  size?: string;
}

export interface OpenModalButtonProps {
  buttonText: React.ReactNode;
  modalComponent: React.ReactElement;
  className?: string;
}

// Redux Action Types
export interface LoadRestaurantsAction {
  type: 'restaurants/loadRestaurants';
  allRestaurants: Restaurant[];
  total: number;
  page: number;
  append: boolean;
}

export interface LoadSingleRestaurantAction {
  type: 'singleRestaurant/loadSingleRestaurant';
  singleRestaurant: SingleRestaurantResponse;
}

export interface ClearSingleRestaurantAction {
  type: 'singleRestaurant/clearSingleRestaurant';
}

export interface SearchRestaurantsAction {
  type: 'restaurants/searchedRestaurants';
  restaurants: RestaurantsResponse;
  append: boolean;
}

export interface SearchLoadingAction {
  type: 'restaurants/searchLoading';
}

export interface SearchErrorAction {
  type: 'restaurants/searchError';
  error: string;
}

export interface ClearSearchAction {
  type: 'restaurants/clearSearchResults';
}

export interface LoadRestaurantsErrorAction {
  type: 'restaurants/loadError';
  error: string;
}

export type RestaurantActionTypes =
  | LoadRestaurantsAction
  | LoadSingleRestaurantAction
  | ClearSingleRestaurantAction
  | SearchRestaurantsAction
  | SearchLoadingAction
  | SearchErrorAction
  | ClearSearchAction
  | LoadRestaurantsErrorAction
  | FavoriteChangedAction;

/**
 * The reader saved or unsaved a restaurant. Every copy of it in the store --
 * the listing, the search results, the detail page -- takes the new flag, so
 * the heart agrees wherever the restaurant is shown next.
 */
export interface FavoriteChangedAction {
  type: "favorites/changed";
  restaurantId: number;
  isFavorited: boolean;
  /** What it was before, so a count only moves when the flag really did. */
  wasFavorited: boolean;
}
