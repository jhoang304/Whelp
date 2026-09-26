import { render, screen, fireEvent, act } from "@testing-library/react";
import PhotoCarousel, { ROTATE_PX_PER_SECOND } from "./PhotoCarousel";

/**
 * The strip drifts on its own and loops; holds still under the pointer or
 * with focus inside; stops for good once someone takes over; and never moves
 * for anyone who asked for less motion.
 *
 * jsdom lays nothing out, so each test gives the strip a size -- 500px of
 * window onto 1200px of photos -- and then asks it to measure again.
 */

const PHOTOS = [0, 1, 2].map((index) => ({ id: index + 10, url: `https://img/${index}.jpg`, index }));

function renderCarousel(onOpen = jest.fn()) {
  const view = render(
    <PhotoCarousel photos={PHOTOS} name="Nancy's Hustle" onOpen={onOpen}
      corner={<button type="button">See all</button>}>
      <h1>Nancy's Hustle</h1>
    </PhotoCarousel>
  );
  const track = document.querySelector(".restaurant-carousel-track") as HTMLElement;
  const set = document.querySelector(".restaurant-carousel-set") as HTMLElement;
  Object.defineProperty(track, "clientWidth", { value: 500, configurable: true });
  Object.defineProperty(set, "scrollWidth", { value: 1200, configurable: true });
  Object.defineProperty(set, "offsetWidth", { value: 1200, configurable: true });
  (track as any).scrollBy = jest.fn();
  act(() => { window.dispatchEvent(new Event("resize")); });
  const section = document.querySelector(".restaurant-carousel") as HTMLElement;
  return { ...view, track, section, onOpen };
}

/** How far it drifts in `ms` of animation frames. */
const drift = (track: HTMLElement, ms: number) => {
  const before = track.scrollLeft;
  act(() => { jest.advanceTimersByTime(ms); });
  return track.scrollLeft - before;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  delete (window as any).matchMedia;
});

test("with more photos than fit, it drifts on its own", () => {
  const { track } = renderCarousel();
  const moved = drift(track, 1000);
  // About a second's worth, allowing for the first frame, which only starts the clock.
  expect(moved).toBeGreaterThan(ROTATE_PX_PER_SECOND * 0.8);
  expect(moved).toBeLessThanOrEqual(ROTATE_PX_PER_SECOND * 1.1);
});

test("it loops: past one copy of the photos, it steps back by exactly that much", () => {
  const { track, section } = renderCarousel();
  // Held still, moved to just short of the join -- one copy (1200px) and
  // the 4px gap -- and let go: the drift picks up from where it is.
  fireEvent.mouseEnter(section);
  track.scrollLeft = 1195;
  fireEvent.mouseLeave(section);

  drift(track, 1000);

  // About 40px on from 1195 is 1235, which is 31px into the second copy.
  expect(track.scrollLeft).toBeGreaterThan(20);
  expect(track.scrollLeft).toBeLessThan(40);
});

test("the copy that makes the loop is hidden from screen readers and skipped by Tab", () => {
  renderCarousel();
  const sets = document.querySelectorAll(".restaurant-carousel-set");
  expect(sets).toHaveLength(2);
  expect(sets[1]).toHaveAttribute("aria-hidden", "true");
  sets[1].querySelectorAll("button").forEach((button) => expect(button).toHaveAttribute("tabindex", "-1"));
  expect(screen.getAllByRole("button", { name: /^Enlarge photo/ })).toHaveLength(3);
});

test("it holds still under the pointer, and carries on when it leaves", () => {
  const { track, section } = renderCarousel();
  fireEvent.mouseEnter(section);
  expect(drift(track, 1000)).toBe(0);

  fireEvent.mouseLeave(section);
  expect(drift(track, 1000)).toBeGreaterThan(0);
});

test("it holds still while focus is inside it", () => {
  const { track } = renderCarousel();
  act(() => { screen.getAllByRole("button", { name: /^Enlarge photo/ })[0].focus(); });
  expect(drift(track, 1000)).toBe(0);
});

test("an arrow stops it for good, and steps through the photos", () => {
  const { track, section } = renderCarousel();
  fireEvent.click(screen.getByRole("button", { name: "Next photos" }));

  expect((track as any).scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "smooth" });
  fireEvent.mouseLeave(section);
  expect(drift(track, 1000)).toBe(0);
});

test("going back from the start steps over the join first, so there is somewhere to go", () => {
  const { track } = renderCarousel();
  track.scrollLeft = 0;
  fireEvent.click(screen.getByRole("button", { name: "Previous photos" }));

  expect(track.scrollLeft).toBe(1204);
  expect((track as any).scrollBy).toHaveBeenCalledWith({ left: -400, behavior: "smooth" });
});

test("a photo stops it and opens, at that photo", () => {
  const { track, onOpen } = renderCarousel();
  fireEvent.click(screen.getByRole("button", { name: "Enlarge photo 2 of 3 of Nancy's Hustle" }));

  expect(onOpen).toHaveBeenCalledWith(1);
  expect(drift(track, 1000)).toBe(0);
});

test("the pause button stops it, and plays it again", () => {
  const { track } = renderCarousel();
  fireEvent.click(screen.getByRole("button", { name: "Pause photos" }));
  expect(drift(track, 1000)).toBe(0);

  fireEvent.click(screen.getByRole("button", { name: "Play photos" }));
  expect(drift(track, 1000)).toBeGreaterThan(0);
});

test("a swipe on a touch screen is taking over", () => {
  const { track } = renderCarousel();
  fireEvent.touchStart(track);
  expect(drift(track, 1000)).toBe(0);
});

test("for anyone who asked for less motion it never moves, and has no pause button", () => {
  (window as any).matchMedia = jest.fn((query: string) => ({
    matches: query.includes("reduce"), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent() { return false; },
  }));
  const { track } = renderCarousel();

  expect(drift(track, 1000)).toBe(0);
  expect(screen.queryByRole("button", { name: /Pause photos/ })).not.toBeInTheDocument();
});

test("with photos that all fit, nothing moves and there are no arrows", () => {
  render(<PhotoCarousel photos={PHOTOS.slice(0, 1)} name="Tiny" onOpen={jest.fn()} />);
  // jsdom's widths are all 0, so one photo "fits".
  expect(screen.queryByRole("button", { name: "Next photos" })).not.toBeInTheDocument();
  expect(document.querySelectorAll(".restaurant-carousel-set")).toHaveLength(1);
});
