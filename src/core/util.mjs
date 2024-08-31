/**
 * Wrap an async function to return a tuple of [error, result] instead of
 * throwing an error. If the wrapped function throws an error, the returned
 * tuple will be [error, null]. If the wrapped function does not throw an
 * error, the returned tuple will be [null, result].
 *
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFunc - The async function to wrap.
 * @returns {(...args: any[]) => Promise<[Error | null, T | null]>} A new async
 *     function that returns a tuple of [error, result].
 */
export function withErrorHandling(asyncFunc) {
    return async function(...args) {
        try {
            const result = await asyncFunc(...args);
            if (result instanceof Error) {
                return [result, null];
            }
            return [null, result];
        } catch (error) {
            return [error, null];
        }
    };
}