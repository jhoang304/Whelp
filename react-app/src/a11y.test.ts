import fs from "fs";
import path from "path";

/**
 * Checks on the components' source that the rendered tests cannot make of
 * every component at once (#122).
 */

function sources(dir: string = path.join(__dirname, "components")): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sources(full);
        return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [full] : [];
    });
}

const files = sources().map((file) => ({
    file: path.relative(__dirname, file).split(path.sep).join("/"),
    text: fs.readFileSync(file, "utf8"),
}));

test("there are components to check", () => {
    expect(files.length).toBeGreaterThan(30);
});

test("every icon is hidden from screen readers", () => {
    // They sit beside words that say the same, or in a button with a label:
    // read out, they are "image" or a stray private-use character.
    const shown = files.flatMap(({ file, text }) => Array.from(text.matchAll(/<i\s[^>]*className=[^>]*>/g))
        .filter((match) => !/aria-hidden="true"/.test(match[0]))
        .map((match) => `${file}: ${match[0]}`));
    expect(shown).toEqual([]);
});

test("going somewhere is a link, not a button that pushes history", () => {
    // A link opens in a new tab and says "link". history.push after
    // something happens -- a save, a log out -- is a different thing.
    const buttons = files.filter(({ text }) => /onClick=\{\s*\(\)\s*=>\s*history\.push\(/.test(text)).map(({ file }) => file);
    expect(buttons).toEqual([]);
});

test("an alert is never the list itself", () => {
    // role="alert" on a <ul> takes its list role away, and its items belong to
    // no list: FormErrors puts the alert round the list instead.
    const lists = files.filter(({ text }) => /<(ul|ol)\b[^>]*role="alert"/.test(text)).map(({ file }) => file);
    expect(lists).toEqual([]);
});
