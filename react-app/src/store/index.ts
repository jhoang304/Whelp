import {
  AnyAction, createStore, combineReducers, applyMiddleware, compose, Store, StoreEnhancer,
} from 'redux';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import logger from 'redux-logger';
import { RootState } from '../types';
import session from './session'
import restaurantsReducer from './restaurants';
import photoReducer from"./restaurantPhoto";
import reviewReducer from './reviews';
import userProfileReducer from './userProfile';
import categoriesReducer from './categories';

const rootReducer = combineReducers({
  session,
  Restaurants: restaurantsReducer,
  photos: photoReducer,
  reviews: reviewReducer,
  user: userProfileReducer,
  categories: categoriesReducer
});

// Define types for dispatch
export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>;
export type { RootState };

/**
 * Use these instead of the bare react-redux hooks: they know the store's
 * shape, so a component does not have to restate it -- and `dispatch(thunk)`
 * type-checks without a cast.
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Enhance the window object for Redux DevTools
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

let enhancer: StoreEnhancer;

// The logger and the devtools hook are for development. A production build
// drops this branch, and the logger with it (#138: it was a require(), which
// Vite's ES modules don't have).
if (import.meta.env.PROD) {
  enhancer = applyMiddleware(thunk);
} else {
  const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  enhancer = composeEnhancers(applyMiddleware(thunk, logger));
}

const configureStore = (preloadedState?: Partial<RootState>): Store<RootState> => {
  return createStore(rootReducer, preloadedState, enhancer);
};

export default configureStore;
