import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './HomePage.css';

function HomePage() {
  useDocumentTitle('Whelp – restaurant reviews');

  // Links, not buttons that push history: they go somewhere, so they open in
  // a new tab and say "link" (#122).
  return (
    <div className="homepage-container">
      <div className="homepage-hero">
        <div className="hero-content">
          <h1>Welcome to Whelp</h1>
          <p className="hero-subtitle">Your Local Guide to Great Food</p>
          <p className="hero-description">Discover, review, and share your favorite restaurants in your area</p>
          <Link className="explore-button" to="/restaurants">
            <span>Explore Restaurants</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>

      <div className="homepage-features">
        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-utensils" aria-hidden="true"></i>
          </div>
          <h2>Find Great Places</h2>
          <p>Browse through our curated list of top-rated restaurants in your neighborhood</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-star" aria-hidden="true"></i>
          </div>
          <h2>Read Reviews</h2>
          <p>Get insights from real customers about their dining experiences</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-pen" aria-hidden="true"></i>
          </div>
          <h2>Share Your Experience</h2>
          <p>Help others discover great food by sharing your own reviews</p>
        </div>
      </div>

      <div className="homepage-cta">
        <div className="cta-content">
          <h2>Ready to Find Your Next Favorite Restaurant?</h2>
          <p>Join our community of food lovers and start exploring today</p>
          <Link className="cta-button" to="/restaurants">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
