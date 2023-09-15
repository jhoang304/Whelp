import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {useHistory, useParams } from "react-router-dom";
import { search_restaurants } from '../../store/restaurants';

function SearchBar() {
    const dispatch = useDispatch()
    const history = useHistory()
    const { params } = useParams()
    const [keyword, setKeyword] = useState("");


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
              <div className="nav-search-container">
                <form onSubmit={handleSearch} className="search-bar-form">
                  <input className='search-input-values'
                    placeholder="Search..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    maxLength="100"
                  />
                  <button type="submit" className="search-button">
                    <i class="fa-solid fa-magnifying-glass"></i>
                  </button>
                </form>
              </div>
            </div>
          );

}

export default SearchBar
