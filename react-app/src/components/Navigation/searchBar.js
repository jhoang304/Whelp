import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory, useParams } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';

function SearchBar() {
    const dispatch = useDispatch()
    const history = useHistory()
    const { params } = useParams()
    const [keyword, setKeyword] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    const handleSearch = async (e) => {
      e.preventDefault();
      if (keyword.trim().length === 0) {
        return;
      }
      const response = await dispatch(search_restaurants(keyword));
      if (response) {
        history.push(`/search/${keyword}`);
      }
      setKeyword("");
    };

    return (
      <div className="nav-search">
        <div className={`nav-search-container ${isFocused ? 'focused' : ''}`}>
          <form onSubmit={handleSearch} className="search-bar-form">
            <input
              className='search-input-values'
              placeholder="Search for restaurants..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              maxLength="100"
            />
            <button type="submit" className="search-button" aria-label="Search">
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
          </form>
        </div>
      </div>
    );
}

export default SearchBar;
