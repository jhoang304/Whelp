/**
 * A fetch whose answers the test hands out itself, in whatever order it
 * likes. What it shows up is a page acting on a slower, older request after
 * the reader has moved on (#115).
 *
 * `immediate` answers what the test doesn't care to hold back (the filter
 * bar's lists, say); everything else waits for `answer`.
 */
export function deferredFetch(immediate: (url: string) => unknown = () => undefined) {
  const waiting: { url: string; resolve: (response: unknown) => void }[] = [];
  (global as any).fetch = jest.fn((url: string) => {
    const now = immediate(url);
    if (now !== undefined) return Promise.resolve(now);
    return new Promise((resolve) => waiting.push({ url, resolve }));
  });
  return {
    /** The URLs still waiting for an answer, oldest first. */
    waiting: () => waiting.map(({ url }) => url),
    /** Answer the oldest waiting request that `matches`. */
    answer: (matches: (url: string) => boolean, response: unknown) => {
      const index = waiting.findIndex(({ url }) => matches(url));
      if (index < 0) throw new Error(`Nothing waiting matches. Waiting: ${waiting.map(({ url }) => url).join(", ")}`);
      waiting.splice(index, 1)[0].resolve(response);
    },
  };
}

export const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

export const refused = (status: number, errors: string[]) =>
  ({ ok: false, status, json: () => Promise.resolve({ errors }) });

/** The query string of a request, to match on. */
export const query = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");
