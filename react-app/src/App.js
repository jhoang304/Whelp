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
import UserProfilePage from "./components/UserPage";
import Footer from "./components/Footer";

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
        <>
          <Switch>
            <Route exact path='/users/get/:userId'>
              <UserProfilePage />
            </Route>
            <Route exact path="/login">
              <LoginFormPage />
            </Route>
            <Route exact path="/signup">
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
          <Footer />
        </>
      )}
    </>
  );
}

export default App;
