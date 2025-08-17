import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';
import { AppDispatch } from '../../store';

function SearchBar(): React.JSX.Element {
    const dispatch = useDispatch<AppDispatch>();
    const history = useHistory();
    const [keyword, setKeyword] = useState<string>("");
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      const trimmedKeyword = keyword.trim();
      if (trimmedKeyword.length === 0) {
        return;
      }

      setIsSearching(true);
      
      try {
        const response = await dispatch(search_restaurants(trimmedKeyword) as any);
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
              maxLength={100}
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
