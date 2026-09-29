import React from "react";
import PageMessage from "../PageMessage";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Where the reader is. When it changes after a failure the page is drawn
   * again, so going somewhere else from the nav bar is a way out.
   */
  resetKey: string;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches an error while a page renders, so one bad value costs that page
 * and not the whole app. Nothing did: any throw during render unmounted
 * everything and left a white screen (#116). App keeps the nav bar outside
 * it, so the reader can still move on.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("A page failed to render:", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <PageMessage
        icon="fa-solid fa-triangle-exclamation"
        title="Something went wrong"
        // A full reload rather than a route change: whatever broke the page
        // may be in what the app is holding, and a reload starts it afresh.
        action={{ href: window.location.pathname + window.location.search, label: "Reload the page" }}
      >
        This page ran into a problem. Reload it to try again, or go somewhere else from the menu above.
      </PageMessage>
    );
  }
}

export default ErrorBoundary;
