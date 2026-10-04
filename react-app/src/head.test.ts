import fs from "fs";
import path from "path";

/**
 * What the page's <head> and manifest promise before any script runs (#130):
 * link previews are read by crawlers that don't run the app, and an install
 * or a home-screen icon is read straight from the manifest.
 */

const PUBLIC = path.join(__dirname, "..", "public");
// Beside package.json since Vite (#138); the files it links to stay in public.
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"));

const meta = (attribute: "name" | "property", key: string) =>
  html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1];

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(file: string): string {
  const data = fs.readFileSync(path.join(PUBLIC, file));
  expect(data.subarray(1, 4).toString()).toBe("PNG");
  return `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
}

/** Each image in an .ico, as "WxH" (0 in the directory means 256). */
function icoSizes(file: string): string[] {
  const data = fs.readFileSync(path.join(PUBLIC, file));
  return Array.from({ length: data.readUInt16LE(4) }, (_, i) => {
    const w = data[6 + 16 * i] || 256;
    const h = data[7 + 16 * i] || 256;
    return `${w}x${h}`;
  });
}

test("there is a description, and a preview for a shared link", () => {
  expect(meta("name", "description")).toBeTruthy();
  expect(meta("property", "og:title")).toBeTruthy();
  expect(meta("property", "og:description")).toBeTruthy();
  expect(meta("name", "twitter:card")).toBe("summary_large_image");
});

test("the preview's image is an absolute address, to a 1200x630 image that is there", () => {
  // Crawlers don't resolve a relative og:image.
  const image = meta("property", "og:image")!;
  expect(image).toMatch(/^https:\/\//);
  const file = new URL(image).pathname.slice(1);
  expect(pngSize(file)).toBe("1200x630");
  expect(`${meta("property", "og:image:width")}x${meta("property", "og:image:height")}`).toBe("1200x630");
});

test("the page and the manifest have the same theme colour", () => {
  expect(meta("name", "theme-color")).toBe(manifest.theme_color);
});

test("an iPhone has its own 180px icon", () => {
  const href = html.match(/<link rel="apple-touch-icon" href="\/([^"]+)"/)?.[1];
  expect(href).toBeTruthy();
  expect(pngSize(href!)).toBe("180x180");
});

test("every icon the manifest names is there, at the size it says", () => {
  // favicon.ico claimed 64x64 32x32 24x24 16x16, and held one 32x32 image.
  for (const icon of manifest.icons) {
    expect(fs.existsSync(path.join(PUBLIC, icon.src))).toBe(true);
    if (icon.type === "image/png") expect(icon.sizes).toBe(pngSize(icon.src));
    if (icon.type === "image/x-icon") expect(icon.sizes.split(" ").sort()).toEqual(icoSizes(icon.src).sort());
  }
});

test("there are the icons an install asks for: 192, 512 and a maskable 512", () => {
  const png = (purpose: string | undefined) =>
    manifest.icons.filter((icon: any) => icon.type === "image/png" && icon.purpose === purpose).map((icon: any) => icon.sizes);
  expect(png(undefined)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(png("maskable")).toEqual(["512x512"]);
});

test("without JavaScript, the page says so", () => {
  expect(html).toMatch(/<noscript>[^<]*JavaScript[^<]*<\/noscript>/);
});

test("the page loads the app as a module, with nothing of Create React App's left in it (#138)", () => {
  expect(html).toContain('<script type="module" src="/src/index.tsx"></script>');
  expect(html).not.toContain("%PUBLIC_URL%");
  // public/ is copied into the build as it is: a second index.html there
  // would be served in place of the built one.
  expect(fs.existsSync(path.join(PUBLIC, "index.html"))).toBe(false);
});
