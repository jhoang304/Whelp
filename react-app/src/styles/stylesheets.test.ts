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
