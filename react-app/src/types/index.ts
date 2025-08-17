// API Response Types
export interface Restaurant {
  id: number;
  user_id: number;
  name: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipcode: number;
  country: string;
  phone_number: string;
  description: string;
  website: string;
  avgRating: number;
  numReviews?: number;
  previewImage: string;
  oneReview: string;
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

export interface Review {
  id: number;
  user_id: number;
  restaurant_id: number;
  review: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  firstName?: string;
  lastName?: string;
}

// API Response Containers
export interface RestaurantsResponse {
  Restaurants: Restaurant[];
}

export interface SingleRestaurantResponse {
  id: number;
  user_id: number;
  name: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipcode: number;
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
}

// Redux State Types
export interface SessionState {
  user: User | null;
}

export interface RestaurantsState {
  allRestaurants?: { [key: number]: Restaurant };
  singleRestaurant?: SingleRestaurantResponse;
  searchedRestaurants?: { [key: number]: Restaurant };
  searchLoading?: boolean;
  searchError?: string | null;
}

export interface PhotosState {
  [key: string]: any; // To be defined based on actual usage
}

export interface ReviewsState {
  [key: string]: any; // To be defined based on actual usage
}

export interface UserProfileState {
  [key: string]: any; // To be defined based on actual usage
}

export interface RootState {
  session: SessionState;
  Restaurants: RestaurantsState;
  photos: PhotosState;
  reviews: ReviewsState;
  user: UserProfileState;
}

// Form Types
export interface LoginFormData {
  credential: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

export interface RestaurantFormData {
  name: string;
  price: string;
  address: string;
  city: string;
  state: string;
  zipcode: number;
  country: string;
  phone_number: string;
  website: string;
  description: string;
  url?: string; // For image
}

export interface ReviewFormData {
  review: string;
  rating: number;
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
  buttonText: string;
  modalComponent: React.ReactElement;
  className?: string;
}

// Utility Types
export type ApiError = {
  message: string;
  errors?: { [key: string]: string };
};

export type ThunkResult<T = void> = (
  dispatch: any,
  getState: () => RootState
) => Promise<T>;

// Redux Action Types
export interface LoadRestaurantsAction {
  type: 'restaurants/loadRestaurants';
  allRestaurants: Restaurant[];
}

export interface LoadSingleRestaurantAction {
  type: 'singleRestaurant/loadSingleRestaurant';
  singleRestaurant: SingleRestaurantResponse;
}

export interface SearchRestaurantsAction {
  type: 'restaurants/searchedRestaurants';
  restaurants: RestaurantsResponse;
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

export interface AddRestaurantAction {
  type: 'restaurants/addRestaurants';
  newRestaurant: Restaurant;
}

export interface UpdateRestaurantAction {
  type: 'restaurants/updateRestaurant';
  restaurant: Restaurant;
}

export interface DeleteRestaurantAction {
  type: 'restaurants/deleteRestaurant';
  id: number;
}

export type RestaurantActionTypes = 
  | LoadRestaurantsAction
  | LoadSingleRestaurantAction 
  | SearchRestaurantsAction
  | SearchLoadingAction
  | SearchErrorAction
  | ClearSearchAction
  | AddRestaurantAction
  | UpdateRestaurantAction
  | DeleteRestaurantAction;
