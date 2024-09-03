import logger from "./logger.mjs";

const log = logger.child(logger.bindings());

/**
 * @template ST
 * @typedef {[null, ST]} SuccessTuple
 * @description A tuple representing a successful operation, where the first element is null (no error), and the second element is the result of type T.
 */

/**
 * @typedef {[Error, null]} ErrorTuple
 * @description A tuple representing an error, where the first element is an Error, and the second element is null (no result).
 */

/**
 * Wraps an asynchronous function with error handling, returning a Promise
 * that resolves to either a SuccessTuple or an ErrorTuple.
 *
 * @template T
 * @template Args
 * @param {function(...Args): Promise<T | Error>} asyncFunc - The asynchronous function to wrap.
 * @returns {function(...Args): Promise<ErrorTuple | SuccessTuple<T>>} A function that returns a promise resolving to either a SuccessTuple or an ErrorTuple.
 */
export function withErrorHandling(asyncFunc) {
    return async function (...args) {
        try {
            const result = await asyncFunc(...args);
            if (result instanceof Error) {
                return /** @type {ErrorTuple} */ ([result, null]);
            }
            return [null, result];
        } catch (error) {
            return /** @type {ErrorTuple} */ ([error, null]);
        }
    };
}

/**
 * Finds a cheerio element based on the given selector, or throws an error
 * if no element is found.
 *
 * @param {ReturnType<cheerio.CheerioAPI.load>} $ - The cheerio object to search for the element.
 * @param {string} selector - The CSS selector to search for.
 * @throws {Error} If no element is found for the given selector.
 * @returns {ReturnType<CheerioAPI>} The cheerio element that was found.
 */
export function getCheerioSelectionOrThrow($, selector) {
    const $selection = $(selector);
    if (!$selection.length) {
        log.error(`No selection found for selector [${selector}]`);
        throw new Error(`No selection found for selector [${selector}]`);
    }
    return $selection;
}

/**
 * @param {any} value
 * @returns {string}
 */
function enforceIsString(value) {
    return (typeof value === 'string' ? value : '');
}

/**
 * Trims, and removes all non-breaking space characters from the given text.
 * @param {any} txt
 * @returns {string} Cleaned text or empty string if the given value is not a string.
 */
export function cleanText(txt) {
    return enforceIsString(txt).trim().replaceAll(' ', ' ');
}

/**
 * Collapses consecutive line breaks with a single line break in the given text.
 * @param {any} txt
 * @returns {string} Collapsed text or empty string if the given value is not a string.
 */
export function collapseConsecutiveLineBreaks(txt) {
    return enforceIsString(txt).replaceAll(/\n+/g, '\n');
}