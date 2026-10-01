import React from "react";
import { Link } from "react-router-dom";
import { SITE, pageTitle, useDocumentTitle } from "../../hooks/useDocumentTitle";
import "./PageMessage.css";

interface PageMessageProps {
  /** Font Awesome classes for the icon above the heading. */
  icon: string;
  title: string;
  children?: React.ReactNode;
  /**
   * The one thing to do next, as a link that looks like a button: `to` for
   * a page in the app, `href` for a full page load, such as a reload.
   */
  action?: { to: string; label: string } | { href: string; label: string };
  /** A second, quieter way on, beside the first: "Go to the home page". */
  secondaryAction?: { to: string; label: string };
  /**
   * The tab's title, before " · Whelp": the heading without its full stop
   * unless this says otherwise, and "" for the site's name alone -- which a
   * "Loading..." message wants, rather than to be announced (#130).
   */
  documentTitle?: string;
}

/**
 * A page with nothing to show but a message: a restaurant or review that
 * isn't there, something you have to log in for, or a page that broke. One
 * component, so each of them says it the same way.
 */
function PageMessage({ icon, title, children, action, secondaryAction, documentTitle }: PageMessageProps): React.JSX.Element {
  const tab = documentTitle ?? title.replace(/\.+$/, "");
  useDocumentTitle(tab ? pageTitle(tab) : SITE);

  return (
    <div className="page-message">
      <i className={icon} aria-hidden="true"></i>
      {/* The page's heading: it is all the page has (#122). */}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {action && ("to" in action
        ? <Link to={action.to} className="page-message-action">{action.label}</Link>
        : <a href={action.href} className="page-message-action">{action.label}</a>
      )}
      {secondaryAction && (
        <Link to={secondaryAction.to} className="page-message-secondary">{secondaryAction.label}</Link>
      )}
    </div>
  );
}

export default PageMessage;
