import React, { useState, useEffect } from "react";
import { Route, Switch } from "react-router-dom";
import { useAppDispatch } from "./store";
import SignupFormPage from "./components/SignupFormPage";
import LoginFormPage from "./components/LoginFormPage";
import { authenticate } from "./store/session";
import Navigation from "./components/Navigation";
import RestaurantList from "./components/RestaurantList"
import SingleRestaurant from "./components/SingleRestaurant"
import CreateNewReview from "./components/Reviews/CreateNewReview";
import UpdateReview from "./components/Reviews/UpdateReview";
import { CREATE_REVIEW_PATH, UPDATE_REVIEW_PATH } from "./components/Reviews/paths";
import UserProfilePage from "./components/UserPage";
import Footer from "./components/Footer";
import RestaurantBySearch, { LegacySearchRedirect } from "./components/SearchBar";
import HomePage from "./components/HomePage";
import AccountSettings from "./components/AccountSettings";

function App(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  
  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <>
      <Navigation />
      {isLoaded && (
        <>
          <Switch>
            <Route exact path='/users/get/:userId'>
              <UserProfilePage />
            </Route>
            <Route exact path="/settings">
              <AccountSettings />
            </Route>
            <Route exact path="/login">
              <LoginFormPage />
            </Route>
            <Route exact path="/signup">
              <SignupFormPage />
            </Route>
            <Route exact path="/search">
              <RestaurantBySearch />
            </Route>
            <Route path="/search/:keyword">
              <LegacySearchRedirect />
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
            <Route exact path={CREATE_REVIEW_PATH}>
              <CreateNewReview />
            </Route>
            <Route exact path={UPDATE_REVIEW_PATH}>
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
