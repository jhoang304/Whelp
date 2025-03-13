import React from 'react';
import { useHistory } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  const history = useHistory();

  const navigateToRestaurants = () => {
    history.push('/restaurants');
  };

  return (
    <div className="homepage-container">
      <div className="homepage-hero">
        <div className="hero-content">
          <h1>Welcome to Whelp</h1>
          <p className="hero-subtitle">Your Local Guide to Great Food</p>
          <p className="hero-description">Discover, review, and share your favorite restaurants in your area</p>
          <button className="explore-button" onClick={navigateToRestaurants}>
            <span>Explore Restaurants</span>
            <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <div className="homepage-features">
        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-utensils"></i>
          </div>
          <h3>Find Great Places</h3>
          <p>Browse through our curated list of top-rated restaurants in your neighborhood</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-star"></i>
          </div>
          <h3>Read Reviews</h3>
          <p>Get insights from real customers about their dining experiences</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-pen"></i>
          </div>
          <h3>Share Your Experience</h3>
          <p>Help others discover great food by sharing your own reviews</p>
        </div>
      </div>

      <div className="homepage-cta">
        <div className="cta-content">
          <h2>Ready to Find Your Next Favorite Restaurant?</h2>
          <p>Join our community of food lovers and start exploring today</p>
          <button className="cta-button" onClick={navigateToRestaurants}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
