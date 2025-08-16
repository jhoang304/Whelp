# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whelp is a full-stack Yelp clone built with Flask/SQLAlchemy backend and React/Redux frontend. Users can browse restaurants, leave reviews, and manage their profiles. The application features user authentication, CRUD operations for restaurants and reviews, and image upload functionality.

## Development Commands

### Backend (Flask)
```bash
# Install dependencies
pipenv install -r requirements.txt

# Activate virtual environment
pipenv shell

# Database setup
flask db upgrade
flask seed all

# Run development server
flask run
```

### Frontend (React)
```bash
# Navigate to frontend directory
cd react-app

# Install dependencies
npm install

# Run development server (note the special NODE_OPTIONS flag)
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

### Backend Structure
- **Flask App**: Main application in `app/__init__.py` with blueprint registration
- **Models**: SQLAlchemy models in `app/models/` (User, Restaurant, Review, RestaurantImage, ReviewImage)
- **API Routes**: RESTful endpoints in `app/api/` organized by resource
- **Forms**: WTForms validation in `app/forms/`
- **Database**: PostgreSQL with Alembic migrations in `migrations/`
- **Seeds**: Sample data population in `app/seeds/`

### Frontend Structure
- **React Router**: Client-side routing with protected routes
- **Redux Store**: State management with separate reducers for session, restaurants, photos, reviews, and user profile
- **Components**: Organized by feature in `react-app/src/components/`
- **Modal System**: Centralized modal context for forms and dialogs

### Key Architecture Notes
- Backend serves React build files in production via catch-all route
- CSRF protection implemented with tokens
- Flask-Login handles user sessions
- Redux Thunk for async actions
- Proxy configuration routes frontend API calls to Flask backend during development

### Database Schema
- Users have many restaurants and reviews
- Restaurants have many reviews and images
- Reviews belong to users and restaurants, can have images
- Production uses schema prefixing for multi-tenancy

## Important Configuration Details
- React app requires `NODE_OPTIONS=--openssl-legacy-provider` flag for compatibility
- Database URL transformation for Heroku deployment (postgres:// → postgresql://)
- HTTPS redirect in production environment
- CORS enabled for cross-origin requests
- Environment-specific Redux DevTools configuration