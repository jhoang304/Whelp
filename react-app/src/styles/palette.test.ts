import fs from "fs";
import path from "path";
import { STAR_FILL } from "../components/RatingStar";

/**
 * The palette meets WCAG AA (#121): 4.5:1 for text, 3:1 for a field's edge
 * and for a graphic that carries meaning. The ratios are worked out from
 * index.css itself, so changing a token re-checks it.
 */

const SRC = path.join(__dirname, "..");
const INDEX = fs.readFileSync(path.join(SRC, "index.css"), "utf8");

function token(name: string): string {
  const match = INDEX.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  if (!match) throw new Error(`--${name} is not a hex colour in index.css`);
  return match[1];
}

function luminance(hex: string): number {
  let digits = hex.replace("#", "");
  if (digits.length === 3) digits = digits.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const WHITE = "#ffffff";
const TEXT = 4.5;
const EDGE = 3;

test("the arithmetic is WCAG's", () => {
  expect(contrast("#000000", WHITE)).toBeCloseTo(21, 5);
  expect(contrast("#767676", WHITE)).toBeCloseTo(4.54, 2);
  expect(contrast("#f00c13", WHITE)).toBeCloseTo(4.41, 2); // the red this replaced
});

test.each([
  ["color-primary", [WHITE, "color-gray-50", "color-gray-100"]],
  ["color-primary-dark", [WHITE, "color-gray-50", "color-gray-100"]],
  ["color-gray-500", [WHITE, "color-gray-50", "color-gray-100"]],
  ["color-gray-600", [WHITE, "color-gray-50", "color-gray-100"]],
  ["color-gray-700", [WHITE, "color-gray-50", "color-gray-100", "color-gray-200"]],
  ["color-gray-800", [WHITE, "color-gray-50", "color-gray-100", "color-gray-200"]],
  ["color-error-text", [WHITE, "#fef2f2"]],
])("--%s is readable as text", (name, backgrounds) => {
  const unreadable = backgrounds
    .map((background) => ({ background, ratio: contrast(token(name), background.startsWith("#") ? background : token(background)) }))
    .filter(({ ratio }) => ratio < TEXT)
    .map(({ background, ratio }) => `on ${background}: ${ratio.toFixed(2)}:1`);
  expect(unreadable).toEqual([]);
});

test.each(["color-primary", "color-primary-dark", "color-error-text"])("white text on --%s is readable", (name) => {
  expect(contrast(WHITE, token(name))).toBeGreaterThanOrEqual(TEXT);
});

test("a field's edge can be seen", () => {
  expect(contrast(token("color-border-input"), WHITE)).toBeGreaterThanOrEqual(EDGE);
});

test("a filled star can be seen, and so can the white star drawn on it", () => {
  expect(contrast(STAR_FILL, WHITE)).toBeGreaterThanOrEqual(EDGE);
});

// --- the colours that failed stay gone -------------------------------------------------

function stylesheets(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

const css = stylesheets().map((file) => ({
  file: path.relative(SRC, file).split(path.sep).join("/"),
  text: fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
}));

test.each([
  ["#f00c13", "the old red, 4.41:1"],
  ["#ff6b35", "the search page's orange, 2.84:1 behind white"],
  ["#007bff", "the review forms' blue, 3.98:1 behind white"],
  ["#d9534f", "the login toast's red, 3.96:1 behind white"],
  ["#dc3545", "the review forms' error red, 3.39:1 on its pink"],
  ["#999", "grey text at 2.85:1"],
])("%s (%s) is not used", (colour) => {
  const pattern = new RegExp(`${colour}(?![0-9a-fA-F])`, "i");
  expect(css.filter(({ text }) => pattern.test(text)).map(({ file }) => file)).toEqual([]);
});

// --- text on the red tint ------------------------------------------------------------------

/** Every rule, @media ones included, as its file, selector and declarations. */
const rules = css.flatMap(({ file, text }) => Array.from(text.matchAll(/([^{}]+)\{([^{}]*)\}/g))
  .map((match) => ({ file, selectors: match[1].split(",").map((part) => part.trim()), body: match[2] })));

/** The text colour a rule sets, as hex, if it sets one this can read. */
function colourOf(body: string | undefined): string | null {
  const value = body?.match(/(?:^|[;\s])color:\s*([^;]+?)\s*(?:;|$)/)?.[1];
  if (!value) return null;
  if (value.startsWith("#")) return value;
  const name = value.match(/^var\(--([\w-]+)\)$/)?.[1];
  return name ? token(name) : null;
}

/**
 * A pale red behind a button that is selected or pointed at: rgba of the red,
 * a few percent, over white. The brand red on it is 4.48:1.
 */
function redTintIn(body: string): string | null {
  const match = body.match(/background(?:-color)?:\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
  if (!match || Number(match[1]) < 200 || Number(match[2]) > 40) return null;
  const alpha = Number(match[4]);
  return "#" + [match[1], match[2], match[3]]
    .map((channel) => Math.round(255 + (Number(channel) - 255) * alpha).toString(16).padStart(2, "0")).join("");
}

test("text on the red tint reads on it", () => {
  const checked: string[] = [];
  const unreadable = rules.flatMap(({ file, selectors, body }) => {
    const tint = redTintIn(body);
    if (!tint) return [];
    return selectors.flatMap((selector) => {
      // A :hover rule takes its colour from the rule it is the hover of.
      const base = selector.replace(/:(hover|focus-visible|focus-within|focus|active)\b/g, "");
      const colour = colourOf(body)
        ?? colourOf(rules.find((rule) => rule.file === file && rule.selectors.includes(base) && colourOf(rule.body))?.body);
      if (!colour) return [];
      checked.push(`${file}: ${selector}`);
      const ratio = contrast(colour, tint);
      return ratio < TEXT ? [`${file}: ${selector}, ${ratio.toFixed(2)}:1`] : [];
    });
  });
  expect(checked).toEqual(expect.arrayContaining([
    "components/AddPhotoModal/AddPhoto.css: .add-photo-mode button.active",
    "components/Reviews/OwnerResponse/OwnerResponse.css: .owner-response-cta:hover",
  ]));
  expect(unreadable).toEqual([]);
});

// --- white over a photo ---------------------------------------------------------------------

/** White text over black at this opacity, over a white photo: the worst photo there is. */
const overWhitePhoto = (alpha: number) => {
  const grey = Math.round(255 * (1 - alpha)).toString(16).padStart(2, "0");
  return contrast(WHITE, `#${grey}${grey}${grey}`);
};

const alphas = (body: string) => Array.from(body.matchAll(/rgba\(\s*0,\s*0,\s*0,\s*([\d.]+)\s*\)/g)).map((match) => Number(match[1]));

const heroRule = (selector: string) => {
  const rule = rules.find((r) => r.file === "components/SingleRestaurant/SingleRestaurant.css" && r.selectors.includes(selector));
  if (!rule) throw new Error(`no rule for ${selector}`);
  return rule.body;
};

test("the shade behind a restaurant's name reads over any photo", () => {
  const shade = heroRule(".restaurant-carousel-track ~ .restaurant-carousel-overlay .restaurant-carousel-content::before");
  // It fades out above the writing, over the same distance it reaches above it.
  const fade = shade.match(/top:\s*-(\d+)px/)![1];
  expect(shade).toContain(`calc(100% - ${fade}px)`);
  // Everything but the last stop -- the clear top of the fade -- is behind the writing.
  const behindWriting = alphas(shade).slice(0, -1);
  expect(behindWriting.length).toBeGreaterThan(0);
  expect(overWhitePhoto(Math.min(...behindWriting))).toBeGreaterThanOrEqual(TEXT);
});

test.each([
  ".restaurant-carousel button.restaurant-carousel-all",
  ".restaurant-carousel button.restaurant-carousel-all:hover",
  ".restaurant-carousel button.restaurant-carousel-pause",
  ".restaurant-carousel button.restaurant-carousel-pause:hover",
])("white on %s reads over any photo", (selector) => {
  const [alpha] = alphas(heroRule(selector));
  expect(alpha).toBeDefined();
  expect(overWhitePhoto(alpha)).toBeGreaterThanOrEqual(TEXT);
});

test("error text uses the error text colour, not the icon red", () => {
  // --color-error is 3.76:1: for icons and borders only.
  const misuses = css.filter(({ text }) => /(^|[;{\s])color:\s*var\(--color-error\)/.test(text)).map(({ file }) => file);
  expect(misuses).toEqual([]);
});
