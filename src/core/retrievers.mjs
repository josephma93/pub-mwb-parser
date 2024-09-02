import logger from "./logger.mjs";
import { withErrorHandling } from "./util.mjs";
import CONSTANTS from "./constants.mjs";

const log = logger.child(logger.bindings());

/**
 * Generates the headers for a fetch request.
 * @param {string} contentType - The expected content type (e.g., 'application/json', 'text/html').
 * @returns {Object} An object containing the headers for the fetch request.
 */
function createHeaders(contentType) {
    return {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
        'Accept': contentType,
        'Accept-Language': 'es-ES,es;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': CONSTANTS.BASE_URL,
    };
}

/**
 * Performs a GET request to the given URL with the given headers.
 * @param {string} url - The URL to fetch.
 * @param {Object} headers - The headers to include in the request.
 * @returns {Promise<{response: Response, elapsedTime: number} | Error>} A promise that resolves to an object containing the response and the elapsed time in seconds,
 *      or an Error object if an error occurred.
 */
async function _fetchContent(url, headers) {
    const startTime = performance.now();

    log.debug(`Sending GET request to [${url}]`);

    try {
        const response = await fetch(url, { headers });
        const elapsedTime = (performance.now() - startTime) / 1000;

        if (!response.ok) {
            const errorMessage = `Failed to fetch [${url}] with status [${response.status}] (${response.statusText}) after [${elapsedTime.toFixed(4)}] seconds. Response headers: [${JSON.stringify(response.headers.raw())}]`;
            log.error(errorMessage);
            return new Error(errorMessage);
        }

        if (elapsedTime > 10) {
            log.warn(`Operation took [${elapsedTime.toFixed(4)}] seconds`);
        }

        return {
            response,
            elapsedTime,
        };
    } catch (error) {
        const elapsedTime = (performance.now() - startTime) / 1000;
        let errorMessage = `Request to [${url}] failed after [${elapsedTime.toFixed(4)}] seconds.`;

        if (error.name === 'TypeError') {
            errorMessage += ` Network or DNS error occurred: [${error.message}]`;
        } else if (error.code === 'ENOTFOUND') {
            errorMessage += ` DNS lookup failed: [${error.message}]`;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage += ` Request timed out: [${error.message}]`;
        } else if (error instanceof SyntaxError) {
            errorMessage += ` Failed to parse response: [${error.message}]`;
        } else {
            errorMessage += ` Unexpected error occurred: [${error.message}]`;
        }

        log.error(errorMessage);
        return new Error(errorMessage);
    }
}

/**
 * Fetches text content from the given URL with error handling.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<Error | string>} A promise that resolves to either an Error object if any error occurs,
 *     or the TEXT content if successful.
 */
async function _getTextContent(url) {
    const headers = createHeaders('text/html');
    const result = await _fetchContent(url, headers);

    if (result instanceof Error) {
        return result;
    }

    try {
        const content = await result.response.text();
        log.info(`Received TEXT content from [${url}] with status code 200 in [${result.elapsedTime.toFixed(4)}] seconds. Content length: [${content.length}]`);
        return content;
    } catch (error) {
        log.error(`Failed to parse TEXT response from [${url}]: [${error.message}]`);
        return new Error(`Failed to parse TEXT response: [${error.message}]`);
    }
}

/**
 * Fetches HTML content from the specified URL with error handling.
 * @returns {ReturnType<withErrorHandling<string>>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is HTML content (or null if an error occurred).
 */
export const getHtmlContent = withErrorHandling(_getTextContent);

/**
 * Fetches JSON content from the given URL with error handling.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<Error | Object>} A promise that resolves to either an Error object if any error occurs,
 *     or the parsed JSON content if successful.
 */
async function _getJsonContent(url) {
    const headers = createHeaders('application/json');
    const result = await _fetchContent(url, headers);

    if (result instanceof Error) {
        return result;
    }

    try {
        const content = await result.response.json();
        log.info(`Received JSON content from [${url}] with status code 200 in [${result.elapsedTime.toFixed(4)}] seconds. Content length: [${JSON.stringify(content).length}]`);
        return content;
    } catch (error) {
        log.error(`Failed to parse JSON response from [${url}]: [${error.message}]`);
        return new Error(`Failed to parse JSON response: [${error.message}]`);
    }
}

/**
 * Fetches JSON content from the specified URL with error handling.
 * @returns {Promise<ErrorTuple | SuccessTuple<ReturnType<typeof _getJsonContent>>>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is JSON content (or null if an error occurred).
 */
export const getJsonContent = withErrorHandling(_getJsonContent);