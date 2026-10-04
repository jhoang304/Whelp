import React, { useState } from 'react';
import { useHistory } from "react-router-dom";
import { searchLocation } from "../../utils/filters";

function SearchBar(): React.JSX.Element {
    const history = useHistory();
    const [keyword, setKeyword] = useState<string>("");

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const trimmedKeyword = keyword.trim();
      // Nothing typed: the search icon is the way to every restaurant, now
      // that the bar has no separate Restaurants link.
      if (trimmedKeyword.length === 0) {
        history.push("/restaurants");
        return;
      }

      // Just go there: the results page runs the search. Running it here
      // first as well sent every search twice, and a failed one emptied the
      // box and put its error on whatever results page was already open.
      history.push(searchLocation(trimmedKeyword));
      setKeyword("");
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
        <div className="nav-search-container">
          <form onSubmit={handleSearch} className="search-bar-form" role="search">
            <input
              className='search-input-values'
              aria-label="Search restaurants"
              placeholder="Search restaurants, cuisine, location..."
              value={keyword}
              onChange={handleKeywordChange}
              maxLength={100}
            />
            <button
              type="submit"
              className="search-button"
              aria-label={browsing ? "Browse all restaurants" : "Search"}
              title={browsing ? "Browse all restaurants" : "Search"}
            >
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            </button>
          </form>
        </div>
      </div>
    );
}

export default SearchBar;
