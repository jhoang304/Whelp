import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { searchLocation } from "../../utils/filters";

/**
 * The search, large, as the first thing on the page (#134): what most people
 * came to do. It goes where the nav's search goes -- the results for what is
 * typed, or every restaurant for nothing.
 *
 * Named, as a landmark, apart from the nav's: two search regions with no
 * names can't be told apart in a screen reader's list of them.
 */
function HeroSearch(): React.JSX.Element {
    const history = useHistory();
    const [keyword, setKeyword] = useState<string>("");

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = keyword.trim();
        history.push(trimmed ? searchLocation(trimmed) : "/restaurants");
    };

    return (
        <form className="home-search" role="search" aria-label="Find a restaurant" onSubmit={handleSubmit}>
            <i className="fa-solid fa-magnifying-glass home-search-icon" aria-hidden="true"></i>
            <input
                type="search"
                className="home-search-input"
                aria-label="Search restaurants"
                placeholder="Tacos, sushi, a city..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                maxLength={100}
            />
            <button type="submit" className="home-search-button">Search</button>
        </form>
    );
}

export default HeroSearch;
