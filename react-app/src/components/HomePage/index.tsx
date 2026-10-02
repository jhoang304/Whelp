import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAppSelector } from '../../store';
import { Category, Restaurant, Review } from '../../types';
import HeroSearch from './HeroSearch';
import HomeSection from './HomeSection';
import { useList } from './useList';
import { RestaurantTile, RestaurantTileSkeleton, ReviewTile, ReviewTileSkeleton } from './tiles';
import './HomePage.css';

/** A cuisine, with how many restaurants are listed under it. */
interface PopularCategory extends Category {
  restaurantCount: number;
}

const TOP_RATED = '/api/restaurants/?sort=rating&min_rating=1&per_page=6';
const NEWEST = '/api/restaurants/?sort=newest&per_page=6';
const CUISINES = '/api/categories/popular?limit=12';
const RECENT_REVIEWS = '/api/reviews/recent?limit=6';

const tiles = (count: number, Skeleton: () => React.JSX.Element, className: string) => (
  <ul className={className}>
    {Array.from({ length: count }, (_, index) => <Skeleton key={index} />)}
  </ul>
);

/**
 * The front page: a search, then what is actually on the site -- its
 * cuisines, its best-rated and newest restaurants, and what people have
 * just written (#134). It was marketing copy that read the same with ten
 * restaurants or ten thousand, and told someone signed in to join.
 */
function HomePage() {
  useDocumentTitle('Whelp – restaurant reviews');
  const sessionUser = useAppSelector((state) => state.session.user);

  const [cuisines, retryCuisines] = useList<PopularCategory>(CUISINES, "Couldn't load the cuisines.");
  const [topRated, retryTopRated] = useList<Restaurant>(TOP_RATED, "Couldn't load the top rated restaurants.");
  const [newest, retryNewest] = useList<Restaurant>(NEWEST, "Couldn't load the newest restaurants.");
  const [reviews, retryReviews] = useList<Review>(RECENT_REVIEWS, "Couldn't load the recent reviews.");

  // Nothing new on the site means nothing on it at all.
  const noRestaurants = newest.status === 'ready' && newest.items.length === 0;

  return (
    <div className="homepage-container">
      <div className="homepage-hero">
        <div className="hero-content">
          <h1>Welcome to Whelp</h1>
          <p className="hero-subtitle">Your Local Guide to Great Food</p>
          <p className="hero-description">Discover, review, and share your favorite restaurants in your area</p>
          <HeroSearch />
          {/* A link, not a button that pushes history: it goes somewhere,
              so it opens in a new tab and says "link" (#122). */}
          <Link className="explore-button" to="/restaurants">
            <span>Explore all restaurants</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>

      <HomeSection
        title="Browse by cuisine"
        state={cuisines}
        retry={retryCuisines}
        skeleton={
          <ul className="home-cuisines">
            {Array.from({ length: 8 }, (_, index) => <li key={index} className="home-cuisine home-skeleton" />)}
          </ul>
        }
      >
        {(items) => (
          <ul className="home-cuisines">
            {items.map((category) => (
              <li key={category.id}>
                <Link className="home-cuisine" to={`/restaurants?category=${encodeURIComponent(category.slug)}`}>
                  <span>{category.name}</span>
                  <span className="home-cuisine-count">
                    {category.restaurantCount}
                    <span className="visually-hidden"> {category.restaurantCount === 1 ? 'restaurant' : 'restaurants'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </HomeSection>

      <HomeSection
        title="Top rated"
        seeAll={{ to: '/restaurants?sort=rating', what: 'top rated restaurants' }}
        state={topRated}
        retry={retryTopRated}
        skeleton={tiles(6, RestaurantTileSkeleton, 'home-tiles')}
      >
        {(items) => (
          <ul className="home-tiles">
            {items.map((restaurant) => <RestaurantTile key={restaurant.id} restaurant={restaurant} />)}
          </ul>
        )}
      </HomeSection>

      <HomeSection
        title="New on Whelp"
        seeAll={{ to: '/restaurants?sort=newest', what: 'new restaurants' }}
        state={newest}
        retry={retryNewest}
        skeleton={tiles(6, RestaurantTileSkeleton, 'home-tiles')}
      >
        {(items) => (
          <ul className="home-tiles">
            {items.map((restaurant) => <RestaurantTile key={restaurant.id} restaurant={restaurant} />)}
          </ul>
        )}
      </HomeSection>

      {noRestaurants && (
        <section className="home-section home-empty" aria-labelledby="home-empty-title">
          <h2 id="home-empty-title" className="home-section-title">No restaurants yet</h2>
          <p>Whelp is waiting for its first restaurant. Once there is one, you'll find it here.</p>
        </section>
      )}

      <HomeSection
        title="Recent reviews"
        state={reviews}
        retry={retryReviews}
        skeleton={tiles(3, ReviewTileSkeleton, 'home-reviews')}
      >
        {(items) => (
          <ul className="home-reviews">
            {items.map((review) => <ReviewTile key={review.id} review={review} />)}
          </ul>
        )}
      </HomeSection>

      {/* Someone signed in has joined already: tell them what they can do. */}
      <section className="homepage-cta" aria-labelledby="home-cta-title">
        <div className="cta-content">
          {sessionUser ? (
            <>
              <h2 id="home-cta-title">Welcome back, {sessionUser.first_name || sessionUser.username}</h2>
              <p>Been somewhere good lately? Tell everyone how it was.</p>
              <div className="cta-actions">
                <Link className="cta-button" to="/restaurants">Find a place to review</Link>
                <Link className="cta-button secondary" to={`/users/get/${sessionUser.id}`}>Your reviews and saved places</Link>
              </div>
            </>
          ) : (
            <>
              <h2 id="home-cta-title">Ready to find your next favorite restaurant?</h2>
              <p>Join our community of food lovers: save the places you want to try, and review the ones you've been to.</p>
              <div className="cta-actions">
                <Link className="cta-button" to="/signup">Create an account</Link>
                <Link className="cta-button secondary" to="/login">Log in</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;
