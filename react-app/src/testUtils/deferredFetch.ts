/**
 * A fetch whose answers the test hands out itself, in whatever order it
 * likes. What it shows up is a page acting on a slower, older request after
 * the reader has moved on (#115).
 *
 * `immediate` answers what the test doesn't care to hold back (the filter
 * bar's lists, say); everything else waits for `answer`.
 */
export function deferredFetch(immediate: (url: string) => unknown = () => undefined) {
  const waiting: { url: string; resolve: (response: unknown) => void; reject: (error: Error) => void }[] = [];
  (global as any).fetch = vi.fn((url: string) => {
    const now = immediate(url);
    if (now !== undefined) return Promise.resolve(now);
    return new Promise((resolve, reject) => waiting.push({ url, resolve, reject }));
  });
  const take = (matches: (url: string) => boolean) => {
    const index = waiting.findIndex(({ url }) => matches(url));
    if (index < 0) throw new Error(`Nothing waiting matches. Waiting: ${waiting.map(({ url }) => url).join(", ")}`);
    return waiting.splice(index, 1)[0];
  };
  return {
    /** The URLs still waiting for an answer, oldest first. */
    waiting: () => waiting.map(({ url }) => url),
    /** Answer the oldest waiting request that `matches`. */
    answer: (matches: (url: string) => boolean, response: unknown) => take(matches).resolve(response),
    /** Fail it the way a dropped connection does: fetch rejects. */
    drop: (matches: (url: string) => boolean) => take(matches).reject(new TypeError("Failed to fetch")),
  };
}

export const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

export const refused = (status: number, errors: string[]) =>
  ({ ok: false, status, json: () => Promise.resolve({ errors }) });

/** The query string of a request, to match on. */
export const query = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");
