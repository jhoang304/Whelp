import React, { useState } from 'react';
import { useHistory } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';
import { useAppDispatch } from "../../store";

function SearchBar(): React.JSX.Element {
    const dispatch = useAppDispatch();
    const history = useHistory();
    const [keyword, setKeyword] = useState<string>("");
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      const trimmedKeyword = keyword.trim();
      // Nothing typed: the search icon is the way to every restaurant, now
      // that the bar has no separate Restaurants link.
      if (trimmedKeyword.length === 0) {
        history.push("/restaurants");
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

    const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Prevent special characters that could cause issues
      if (value.length <= 100) {
        setKeyword(value);
      }
    };

    const browsing = keyword.trim().length === 0;

    return (
      <div className="nav-search">
        <div className={`nav-search-container ${isFocused ? 'focused' : ''}`}>
          <form onSubmit={handleSearch} className="search-bar-form" role="search">
            <input
              className='search-input-values'
              aria-label="Search restaurants"
              placeholder="Search restaurants, cuisine, location..."
              value={keyword}
              onChange={handleKeywordChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              maxLength={100}
              disabled={isSearching}
            />
            <button
              type="submit"
              className="search-button"
              aria-label={browsing ? "Browse all restaurants" : "Search"}
              title={browsing ? "Browse all restaurants" : "Search"}
              disabled={isSearching}
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
