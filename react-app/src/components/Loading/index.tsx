import React from "react";
import "./Loading.css";

/**
 * A page's "Loading..." while its data is on the way: a spinner, and the word
 * with three bouncing dots.
 *
 * The restaurant list and the restaurant page each drew this, with the same
 * class names in two stylesheets, so whichever loaded last styled both: the
 * list's loader came out 400px tall with a spinner track you could barely
 * see (#120). One component, one stylesheet.
 */
function Loading(): React.JSX.Element {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">
        <span className="loading-word">Loading</span>
        <span className="loading-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
}

export default Loading;
