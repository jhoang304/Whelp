import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Route, Switch } from "react-router-dom";
import SignupFormPage from "./components/SignupFormPage";
import LoginFormPage from "./components/LoginFormPage";
import { authenticate } from "./store/session";
import Navigation from "./components/Navigation";
import RestaurantList from "./components/RestaurantList"
import SingleRestaurant from "./components/SingleRestaurant"
import CreateNewReview from "./components/Reviews/CreateNewReview";
import UpdateReview from "./components/Reviews/UpdateReview";

function App() {
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <>
      <Navigation isLoaded={isLoaded} />
      {isLoaded && (
        <Switch>
          <Route path="/login" exact={true} >
            <LoginFormPage />
          </Route>
          <Route path="/signup" exact={true}>
            <SignupFormPage />
          </Route>
          <Route exact path="/">
            <RestaurantList />
          </Route>
          <Route exact path="/single/:restaurantId">
            <SingleRestaurant />
          </Route>
          <Route exact path="/:restaurantId/create-review">
            <CreateNewReview />
          </Route>
          <Route exact path="/:restaurantId/reviews/:reviewId/update">
            <UpdateReview />
          </Route>
        </Switch>
      )}
    </>
  );
}

export default App;
