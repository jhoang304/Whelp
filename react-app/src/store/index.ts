import { createStore, combineReducers, applyMiddleware, compose, Store } from 'redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import { RootState } from '../types';
import session from './session'
import restaurantsReducer from './restaurants';
import photoReducer from"./restaurantPhoto";
import reviewReducer from './reviews';
import userProfileReducer from './userProfile';

const rootReducer = combineReducers({
  session,
  Restaurants: restaurantsReducer,
  photos: photoReducer,
  reviews: reviewReducer,
  user: userProfileReducer
});

// Define types for dispatch
export type AppDispatch = ThunkDispatch<RootState, unknown, any>;

// Enhance the window object for Redux DevTools
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

let enhancer;

if (process.env.NODE_ENV === 'production') {
  enhancer = applyMiddleware(thunk);
} else {
  const logger = require('redux-logger').default;
  const composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  enhancer = composeEnhancers(applyMiddleware(thunk, logger));
}

const configureStore = (preloadedState?: Partial<RootState>): Store<RootState> => {
  return createStore(rootReducer, preloadedState, enhancer);
};

export default configureStore;
