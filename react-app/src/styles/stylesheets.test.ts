import fs from "fs";
import path from "path";

/**
 * Every stylesheet a component imports ends up in one global sheet, so a rule
 * written for one page applies to all of them (#120). These are the rules
 * that keep it from happening again, checked over every .css file in src:
 *
 * - Only index.css styles a bare element. `a:link { display: flex }` in
 *   SearchBar.css made every link in the app a flex box.
 * - A keyframes name is defined once. Five files defined `fadeIn`, and all
 *   five animations got whichever loaded last.
 * - A class is styled at the top level in one file. `.input-group` and the
 *   `.loading-*` loader were styled in two, and one file's look won on both
 *   pages. A class restyled inside another (`.restaurant-actions .favorite`)
 *   is an override on purpose, and is fine.
 * - Font Awesome's own classes are left alone: `.fa-spin` was redefined, and
 *   every spinner in the app changed speed.
 */

const SRC = path.join(__dirname, "..");

function stylesheets(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

const relative = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

/** The file with comments taken out. */
const source = (file: string) => fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Each @keyframes block's name, and the text with those blocks taken out. */
function keyframes(css: string): { names: string[]; rest: string } {
  const names: string[] = [];
  let rest = "";
  let i = 0;
  const pattern = /@keyframes\s+([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css))) {
    names.push(match[1]);
    rest += css.slice(i, match.index);
    let depth = 1;
    let j = pattern.lastIndex;
    while (depth > 0 && j < css.length) {
      if (css[j] === "{") depth += 1;
      if (css[j] === "}") depth -= 1;
      j += 1;
    }
    i = j;
    pattern.lastIndex = j;
  }
  return { names, rest: rest + css.slice(i) };
}

/** Every selector in the file, @media blocks included, one per comma. */
function selectors(css: string): string[] {
  const { rest } = keyframes(css);
  return Array.from(rest.matchAll(/([^{};]+)\{/g))
    .map((match) => match[1].trim())
    .filter((prelude) => prelude && !prelude.startsWith("@"))
    .flatMap((prelude) => prelude.split(",").map((part) => part.trim()));
}

const ELEMENT = /^(a|abbr|body|button|div|form|h[1-6]|html|img|input|label|li|ol|p|select|span|table|td|textarea|th|ul)(:{1,2}[\w-]+(\([^)]*\))?)*$/;
const TOP_LEVEL_CLASS = /^\.([\w-]+)(:{1,2}[\w-]+(\([^)]*\))?)*$/;

const files = stylesheets();

test("there are stylesheets to check", () => {
  expect(files.map(relative)).toEqual(expect.arrayContaining(["index.css", "components/SearchBar/SearchBar.css"]));
});

test("only index.css styles a bare element", () => {
  const leaks = files
    .filter((file) => relative(file) !== "index.css")
    .flatMap((file) => selectors(source(file)).filter((selector) => ELEMENT.test(selector))
      .map((selector) => `${relative(file)}: ${selector}`));
  expect(leaks).toEqual([]);
});

test("each keyframes name is defined in one file, once", () => {
  const where = new Map<string, string[]>();
  for (const file of files) {
    for (const name of keyframes(source(file)).names) {
      where.set(name, [...(where.get(name) ?? []), relative(file)]);
    }
  }
  const twice = Array.from(where.entries()).filter(([, places]) => places.length > 1)
    .map(([name, places]) => `${name}: ${places.join(", ")}`);
  expect(twice).toEqual([]);
});

test("a class is styled at the top level in one file only", () => {
  const where = new Map<string, Set<string>>();
  for (const file of files) {
    for (const selector of selectors(source(file))) {
      const match = selector.match(TOP_LEVEL_CLASS);
      if (!match) continue;
      const places = where.get(match[1]) ?? new Set<string>();
      places.add(relative(file));
      where.set(match[1], places);
    }
  }
  const shared = Array.from(where.entries()).filter(([, places]) => places.size > 1)
    .map(([name, places]) => `.${name}: ${Array.from(places).join(", ")}`);
  expect(shared).toEqual([]);
});

test("Font Awesome's classes are its own", () => {
  const overrides = files.flatMap((file) => selectors(source(file))
    .filter((selector) => /(^|[\s>+~])\.fa-[\w-]+$/.test(selector) && !selector.includes(" "))
    .map((selector) => `${relative(file)}: ${selector}`));
  expect(overrides).toEqual([]);
});

test("the checks see what they are looking for", () => {
  // The same parsing, on the rules this was written about.
  expect(selectors("a:link { display: flex } .x a { color: red }").filter((s) => ELEMENT.test(s))).toEqual(["a:link"]);
  expect(keyframes("@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } .y {}").names).toEqual(["fadeIn"]);
  expect(selectors("@media (max-width: 600px) { h1 { margin: 0 } }")).toEqual(["h1"]);
  expect(".input-group".match(TOP_LEVEL_CLASS)![1]).toBe("input-group");
  expect(".restaurant-actions .favorite".match(TOP_LEVEL_CLASS)).toBeNull();
});

// --- focus you can see (#122) ---------------------------------------------------------

/** Every rule, @media ones included, as its file, selectors and declarations. */
const rules = files.flatMap((file) => {
    const { rest } = keyframes(source(file));
    return Array.from(rest.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((match) => ({
        file: relative(file),
        selectors: match[1].trim().split(",").map((part) => part.trim()),
        body: match[2],
    }));
});

/**
 * Focused on purpose, and not controls: focus is put there so a screen reader
 * starts in the right place, and nobody tabs to them.
 */
const NOT_CONTROLS = [
    "context/Modal.css: #modal-content:focus",
    "components/Lightbox/Lightbox.css: .image-viewer-overlay:focus",
    "components/RestaurantForm/RestaurantForm.css: .restaurant-form .error-container:focus",
    "components/UserPage/UserProfilePage.css: .profile-empty h2:focus",
];

test("a control's own focus style keeps an outline, for Windows' high contrast mode", () => {
    // High contrast mode drops box-shadows and border colours, and keeps an
    // outline, drawn in its own colour even when it is transparent. So
    // `outline: none` beside a glow leaves nothing to see there.
    const removed = rules
        .filter(({ body }) => /(^|[;\s])outline:\s*(none|0)\s*(;|$)/.test(body))
        .flatMap(({ file, selectors }) => selectors.filter((s) => /:focus/.test(s)).map((s) => `${file}: ${s}`))
        .filter((rule) => !NOT_CONTROLS.includes(rule));
    expect(removed).toEqual([]);
});

test("a file picker's invisible input shows its focus on what can be seen", () => {
    // The input is laid over its box at opacity 0, and its ring goes with it.
    const hidden = rules.flatMap(({ file, selectors, body }) => /opacity:\s*0\s*(;|$)/.test(body)
        ? selectors.filter((s) => /input\[type="file"\]$/.test(s)).map((s) => ({ file, box: s.replace(/\s*input\[type="file"\]$/, "") }))
        : []);
    expect(hidden.map(({ box }) => box)).toEqual(expect.arrayContaining([".add-photo-dropzone", ".update-profile-file"]));
    const unseen = hidden.filter(({ box }) => !rules.some(({ selectors }) =>
        selectors.some((s) => s.startsWith(`${box}:focus-within`))));
    expect(unseen.map(({ file, box }) => `${file}: ${box}`)).toEqual([]);
});

test.each([
    ".hours-editor .hours-editor-timezone select",
    ".update-profile-remove",
    ".filter-clear",
])("%s is a target big enough to tap", (selector) => {
    // WCAG 2.2 asks 24px; these were 18 to 21.
    const rule = rules.find(({ selectors }) => selectors.includes(selector));
    const minHeight = Number(rule?.body.match(/min-height:\s*(\d+)px/)?.[1]);
    expect(minHeight).toBeGreaterThanOrEqual(24);
});

// --- the footer under the page, not over it (#125) ------------------------------------

test("only an overlay is fixed to the window", () => {
    // The footer was: over the bottom 40px of every page, with nothing keeping
    // that space clear, so the last search result ran under it.
    const OVERLAYS = ["context/Modal.css", "components/Lightbox/Lightbox.css"];
    const fixed = rules
        .filter(({ file, body }) => !OVERLAYS.includes(file) && /(^|[;\s])position:\s*fixed/.test(body))
        .flatMap(({ file, selectors }) => selectors.map((selector) => `${file}: ${selector}`));
    expect(fixed).toEqual([]);
});

test("the app is three rows, the nav, the page and the footer, at least the window tall", () => {
    const root = rules.find(({ file, selectors }) => file === "index.css" && selectors.includes("#root"));
    expect(root?.body).toMatch(/display:\s*grid/);
    expect(root?.body).toMatch(/grid-template-rows:\s*auto 1fr auto/);
    expect(root?.body).toMatch(/min-height:\s*100dvh/);
});

test("no page sizes itself by guessing the nav's and the footer's heights", () => {
    // "calc(100vh - 160px)" was login's and signup's. The page's row is the
    // height left between them, and a page fills it with min-height: 100%.
    const guesses = rules
        .filter(({ file, body }) => file !== "context/Modal.css" && /calc\(\s*100d?vh\s*-/.test(body))
        .flatMap(({ file, selectors }) => selectors.map((selector) => `${file}: ${selector}`));
    expect(guesses).toEqual([]);
});

test("no rule restyles every link in a list of cards", () => {
    // `.search-restaurant-list a { margin: auto }` was for the old card-sized
    // link; once the cuisines were links, it spread them across the card.
    const everyLink = rules.flatMap(({ file, selectors }) => selectors
        .filter((selector) => /^\.(restaurant-list|search-restaurant-list)\s+a$/.test(selector))
        .map((selector) => `${file}: ${selector}`));
    expect(everyLink).toEqual([]);
});
