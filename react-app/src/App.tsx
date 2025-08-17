import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Route, Switch } from "react-router-dom";
import { AppDispatch } from "./store";
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
import RestaurantBySearch from "./components/SearchBar";
import HomePage from "./components/HomePage";

function App(): React.JSX.Element {
  const dispatch = useDispatch<AppDispatch>();
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  
  useEffect(() => {
    dispatch(authenticate() as any).then(() => setIsLoaded(true));
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
            <Route path="/search/:keyword" >
              <RestaurantBySearch />
            </Route>
            <Route exact path="/">
              <HomePage />
            </Route>
            <Route exact path="/restaurants">
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
