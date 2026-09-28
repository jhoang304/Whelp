import React from "react";
import { Link } from "react-router-dom";
import "./PageMessage.css";

interface PageMessageProps {
  /** Font Awesome classes for the icon above the heading. */
  icon: string;
  title: string;
  children?: React.ReactNode;
  /** The one thing to do next, as a link that looks like a button. */
  action?: { to: string; label: string };
}

/**
 * A page with nothing to show but a message: a restaurant or review that
 * isn't there, or something you have to log in for. One component, so each
 * of them says it the same way.
 */
function PageMessage({ icon, title, children, action }: PageMessageProps): React.JSX.Element {
  return (
    <div className="page-message">
      <i className={icon} aria-hidden="true"></i>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && (
        <Link to={action.to} className="page-message-action">{action.label}</Link>
      )}
    </div>
  );
}

export default PageMessage;
