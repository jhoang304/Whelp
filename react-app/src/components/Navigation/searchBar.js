import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';

function SearchBar() {
    const dispatch = useDispatch();
    const history = useHistory();
    const [keyword, setKeyword] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
      e.preventDefault();
      
      const trimmedKeyword = keyword.trim();
      if (trimmedKeyword.length === 0) {
        return;
      }

      setIsSearching(true);
      
      try {
        const response = await dispatch(search_restaurants(trimmedKeyword));
        if (response) {
          history.push(`/search/${encodeURIComponent(trimmedKeyword)}`);
        }
        setKeyword("");
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const handleKeywordChange = (e) => {
      const value = e.target.value;
      // Prevent special characters that could cause issues
      if (value.length <= 100) {
        setKeyword(value);
      }
    };

    return (
      <div className="nav-search">
        <div className={`nav-search-container ${isFocused ? 'focused' : ''}`}>
          <form onSubmit={handleSearch} className="search-bar-form">
            <input
              className='search-input-values'
              placeholder="Search restaurants, cuisine, location..."
              value={keyword}
              onChange={handleKeywordChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              maxLength="100"
              disabled={isSearching}
            />
            <button 
              type="submit" 
              className="search-button" 
              aria-label="Search"
              disabled={isSearching || keyword.trim().length === 0}
            >
              {isSearching ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <i className="fa-solid fa-magnifying-glass"></i>
              )}
            </button>
          </form>
        </div>
      </div>
    );
}

export default SearchBar;
