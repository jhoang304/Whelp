import { directionsHref, telHref, websiteHref, websiteLabel } from "./contact";

/** The contact card's links, on the input the forms accept (#123). */

describe("the phone link", () => {
  it("dials the number, and keeps the extension apart", () => {
    // It ran the digits together: tel:832344805112, a different number.
    expect(telHref("(832) 344-8051 x12")).toBe("tel:8323448051;ext=12");
    expect(telHref("(832) 344-8051 ext. 12")).toBe("tel:8323448051;ext=12");
    expect(telHref("832-344-8051, ext 7")).toBe("tel:8323448051;ext=7");
  });

  it("keeps a leading plus, and needs no extension", () => {
    expect(telHref("+1 555 123 4567")).toBe("tel:+15551234567");
    expect(telHref("(832) 344-8051")).toBe("tel:8323448051");
  });
});

describe("the directions link", () => {
  const query = (address: string) => new URL(directionsHref(address)).searchParams.get("query");

  it("gives Maps the whole address, whatever it has in it", () => {
    // A "#" started a fragment, and nothing after it reached Maps.
    expect(query("2704 Polk St #100, Houston, TX, 77003, USA")).toBe("2704 Polk St #100, Houston, TX, 77003, USA");
    expect(query("Bar & Grill Plaza?, Austin, TX")).toBe("Bar & Grill Plaza?, Austin, TX");
  });

  it("is Google's documented search link", () => {
    const url = new URL(directionsHref("1 Main St"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
  });
});

describe("the website link", () => {
  it("leaves a scheme it has, in any case", () => {
    expect(websiteHref("https://nancyshustle.com/")).toBe("https://nancyshustle.com/");
    expect(websiteHref("HTTPS://NANCYSHUSTLE.COM")).toBe("HTTPS://NANCYSHUSTLE.COM");
  });

  it("adds one to a site whose name only starts with http", () => {
    // It was taken to have one, and linked inside the app: /single/httpster.com.
    expect(websiteHref("httpster.com")).toBe("http://httpster.com");
    expect(websiteHref("nancyshustle.com")).toBe("http://nancyshustle.com");
  });

  it("is shown without its scheme or trailing slash", () => {
    expect(websiteLabel("HTTP://nancyshustle.com/")).toBe("nancyshustle.com");
    expect(websiteLabel("httpster.com")).toBe("httpster.com");
  });
});
