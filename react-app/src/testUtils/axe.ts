import { configureAxe } from "jest-axe";

/**
 * axe, for the component tests (#122): what a screen reader or keyboard
 * would trip over, checked on each page as the tests draw it.
 *
 * Two rules are off. Colour contrast, because jsdom draws nothing and axe
 * has no colours to compare -- src/styles/palette.test.ts works the ratios
 * out instead. And "region", everything inside a landmark, because a page
 * drawn on its own has no nav, main or footer around it; App.test.tsx checks
 * that with the whole app.
 */
export const axe = configureAxe({
    rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
    },
});
