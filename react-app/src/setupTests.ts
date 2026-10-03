// Loaded before every test file (vite.config.ts, test.setupFiles). Adds the
// jest-dom matchers (toBeDisabled, toBeInTheDocument, ...) that the component
// tests rely on, and jest-axe's toHaveNoViolations (see testUtils/axe.ts).
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);
