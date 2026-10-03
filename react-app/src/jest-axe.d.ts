/**
 * jest-axe works under Vitest as it did under Jest, but its own types are
 * written against Jest's globals, which collide with Vitest's (#138). This is
 * the part of it the tests use. No imports: an ambient module declaration
 * has to sit in a file that isn't a module itself.
 */
declare module "jest-axe" {
    type AxeResults = import("axe-core").AxeResults;
    type RunOptions = import("axe-core").RunOptions;
    type Spec = import("axe-core").Spec;
    type ConfiguredAxe = (html: Element | string, options?: RunOptions) => Promise<AxeResults>;

    export function configureAxe(options?: RunOptions & { globalOptions?: Spec; impactLevels?: string[] }): ConfiguredAxe;
    export const axe: ConfiguredAxe;
    export const toHaveNoViolations: {
        toHaveNoViolations(results: AxeResults): { actual: unknown; message(): string; pass: boolean };
    };
}
