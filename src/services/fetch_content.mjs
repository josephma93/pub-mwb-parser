import {withErrorHandling} from "../core/util.mjs";
import {Constants} from '../core/constants.mjs';
import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";

const log = logger.child(logger.bindings());

/**
 * Fetches the HTML content from the given URL.
 * @param {string} url The URL to fetch.
 * @returns {Error| string} An Error object if any error occurs, or the HTML content.
 */
async function _getHtmlContent(url) {
    const startTime = performance.now();

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': Constants.BASE_URL,
    };

    log.debug(`Sending GET request to ${url} with headers:`, headers);

    try {
        const response = await fetch(url, { headers });
        const elapsedTime = (performance.now() - startTime) / 1000;

        if (!response.ok) {
            const errorMessage = `Failed to fetch ${url} with status ${response.status} (${response.statusText}) after ${elapsedTime.toFixed(4)} seconds. Response headers: ${JSON.stringify(response.headers.raw())}`;
            log.error(errorMessage);
            return new Error(errorMessage);
        }

        const html = await response.text();
        log.info(`Received HTML content from ${url} with status code 200 in ${elapsedTime.toFixed(4)} seconds. HTML length: ${html.length}`);
        if (elapsedTime > 10) {
            log.warn(`Operation took ${elapsedTime.toFixed(4)} seconds`);
        }
        return html;

    } catch (error) {
        const elapsedTime = (performance.now() - startTime) / 1000;
        let errorMessage = `Request to ${url} failed after ${elapsedTime.toFixed(4)} seconds.`;

        if (error.name === 'TypeError') {
            errorMessage += ` Network or DNS error occurred: ${error.message}`;
        } else if (error.code === 'ENOTFOUND') {
            errorMessage += ` DNS lookup failed: ${error.message}`;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage += ` Request timed out: ${error.message}`;
        } else if (error instanceof SyntaxError) {
            errorMessage += ` Failed to parse response as HTML: ${error.message}`;
        } else {
            errorMessage += ` Unexpected error occurred: ${error.message}`;
        }

        log.error(errorMessage);
        return new Error(errorMessage);
    }
}

/**
 * Exports a function that fetches HTML content with error handling.
 *
 * @function getHtmlContent
 * @description Fetches HTML content from a URL and handles any errors that occur.
 * @returns {[Error | null, string | null]} A tuple with the error (if any) and the HTML content.
 *     If the request is successful, the first element of the tuple will be null and the second
 *     element will be the HTML content. If the request fails, the first element of the tuple will
 *     be an Error object and the second element will be null.
 * @see _getHtmlContent
 */
export const getHtmlContent = withErrorHandling(_getHtmlContent);


/**
 * Fetches the landing HTML from the WOL website.
 * @returns {Error| string} An Error object if any error occurs, or the HTML content.
 */
async function _fetchLandingHtml() {
    const baseUrl = Constants.BASE_URL;

    log.info(`Fetching landing HTML from ${baseUrl}`);
    let [err, html] = await getHtmlContent(baseUrl);
    if (err) {
        return err;
    }

    const $ = cheerio.load(html);
    const selector = 'link[hreflang="es"]';
    const hrefLangEs = $(selector).attr('href');
    log.debug(`Value for hrefLangEs: ${hrefLangEs}`);

    if (!hrefLangEs) {
        log.error(`No href found for ${selector}`);
        return new Error("No href found, website structure may have changed");
    }

    log.info(`Fetching HTML content from ${baseUrl}${hrefLangEs}`);
    [err, html] = await getHtmlContent(baseUrl + hrefLangEs);
    if (err) {
        return err;
    }

    return html;
}

/**
 * Fetches the landing HTML from the WOL website.
 * @returns {[Error | null, string | null]} A tuple with the error (if any) and the HTML content.
 *     If the request is successful, the first element of the tuple will be null and the second
 *     element will be the HTML content. If the request fails, the first element of the tuple will
 *     be an Error object and the second element will be null.
 * @see _fetchLandingHtml
 */
export const fetchLandingHtml = withErrorHandling(_fetchLandingHtml);

/**
 * Fetches this week's meeting HTML from the WOL website, given the base HTML content if provided or fetching
 * the landing HTML as default.
 * @param {string} [baseHtml] The base HTML content to parse. If not provided, the landing HTML will
 *     be fetched and used as default value.
 * @returns {Error| string} An Error object if any error occurs, or the HTML content.
 */
async function _fetchThisWeekMeetingHtml(baseHtml) {
    if (!baseHtml) {
        log.debug("Base HTML missing, fetching landing HTML as default");
        const [err, html] = await fetchLandingHtml();
        if (err) {
            return err;
        }
        baseHtml = html;
    }

    log.debug("Parsing base HTML");
    const $ = cheerio.load(baseHtml);

    log.debug("Selecting today's navigation link");
    const selector = '#menuToday .todayNav';
    const todayNav = $(selector).attr('href');
    log.debug(`Value for href: ${todayNav}`);
    if (!todayNav) {
        log.warn(`No href found for ${selector}`);
        return new Error("No href found, website structure may have changed");
    }

    log.info(`Fetching today's HTML content from ${Constants.BASE_URL}${todayNav}`);
    let [err, html] = await getHtmlContent(Constants.BASE_URL + todayNav);
    if (err) {
        return err;
    }

    return html;
}

/**
 * Fetches the today's HTML from the WOL website, given the base HTML content if provided or fetching
 * the landing HTML as default.
 * @param {string} [baseHtml] The base HTML content to parse. If not provided, the landing HTML will
 *     be fetched and used as default value.
 * @returns {[Error | null, string | null]} A tuple with the error (if any) and the HTML content.
 *     If the request is successful, the first element of the tuple will be null and the second
 *     element will be the HTML content. If the request fails, the first element of the tuple will
 *     be an Error object and the second element will be null.
 * @see _fetchThisWeekMeetingHtml
 */
export const fetchThisWeekMeetingHtml = withErrorHandling(_fetchThisWeekMeetingHtml);

/**
 * Extracts the URL of the weekly watchtower article from the given HTML content of this week's meeting program.
 * @param {string} [thisWeekMeetingProgram] The HTML content of this week's meeting program.
 *     If not provided, the HTML content will be fetched and used as default value.
 * @returns {Error| string} An Error object if any error occurs, or the string with the href value.
 */
async function _extractWatchtowerArticleUrl(thisWeekMeetingProgram) {
    if (!thisWeekMeetingProgram) {
        log.debug("This week's HTML missing, fetching this week's HTML as default");
        const [err, html] = await fetchThisWeekMeetingHtml();
        if (err) {
            return err;
        }
        thisWeekMeetingProgram = html;
    }
    log.debug("Parsing this week's HTML");
    const $ = cheerio.load(thisWeekMeetingProgram);
    const selector = '.todayItem.pub-w:nth-child(2) .itemData a';

    const pubWItem = $(selector).attr('href');
    log.debug(`Value for href: ${pubWItem}`);
    if (!pubWItem) {
        log.error(`No href found for ${selector}`);
        return new Error("No href found, website structure may have changed");
    }

    return `${Constants.BASE_URL}${pubWItem}`;
}

/**
 * Extracts the URL of the weekly watchtower article from the given HTML content of
 * this week's meeting program.
 * @param {string} [thisWeekMeetingProgram] The HTML content of this week's meeting program.
 *     If not provided, the HTML content will be fetched from the WOL website.
 * @returns {[Error | null, string | null]} A tuple with the error (if any) and the URL of
 *     the weekly watchtower article. If the request is successful, the first element of the
 *     tuple will be null and the second element will be the URL of the weekly watchtower
 *     article. If the request fails, the first element of the tuple will be an Error object
 *     and the second element will be null.
 * @see _extractWatchtowerArticleUrl
 */
const extractWatchtowerArticleUrl = withErrorHandling(_extractWatchtowerArticleUrl);

/**
 * Fetches the weekly watchtower article HTML from the WOL website, given the weekly meeting
 * program HTML content if provided or fetching the landing HTML as default.
 * @param {string} [thisWeekMeetingProgram] The this week's meeting program HTML content to parse.
 *     If not provided, the weekly meeting HTML will be fetched as default.
 * @returns {Error| string} An Error object if any error occurs, or the HTML content.
 */
export async function _fetchThisWeekWatchtowerArticleHtml(thisWeekMeetingProgram) {
    let [err, watchtowerArticleUrl] = await extractWatchtowerArticleUrl(thisWeekMeetingProgram);
    if (err) {
        return err;
    }

    log.info(`Fetching weekly HTML content from ${watchtowerArticleUrl}`);
    let html;
    [err, html] = await getHtmlContent(watchtowerArticleUrl);
    if (err) {
        return err;
    }

    log.debug("Parsing this week's watchtower article HTML");
    const $ = cheerio.load(html);
    const selector = '#article';
    const article = $(selector);
    if (!article.length) {
        log.error(`No article found for ${selector}`);
        return new Error("No article found, website structure may have changed");
    }

    log.info(`Successfully fetched and extracted this week's watchtower article HTML from ${watchtowerArticleUrl}`);
    return article.html();
}

/**
 * Fetches the weekly watchtower article HTML from the WOL website, given the weekly meeting
 * program HTML content if provided or fetching the landing HTML as default.
 * @param {string} [thisWeekMeetingProgram] The this week's meeting program HTML content to parse.
 *     If not provided, the weekly meeting HTML will be fetched as default.
 * @returns {[Error | null, string | null]} A tuple with the error (if any) and the HTML content.
 *     If the request is successful, the first element of the tuple will be null and the second
 *     element will be the HTML content. If the request fails, the first element of the tuple will
 *     be an Error object and the second element will be null.
 * @see _fetchThisWeekWatchtowerArticleHtml
 */
export const fetchThisWeekWatchtowerArticleHtml = withErrorHandling(_fetchThisWeekWatchtowerArticleHtml);

export function parseUrl(url) {
    log.debug(`Parsing URL: ${url}`);
    try {
        const parsedUrl = new URL(url);
        log.debug(`Parsed URL:`, parsedUrl);
        return {
            host: parsedUrl.host,
            pathParts: parsedUrl.pathname.split('/')
        };
    } catch (error) {
        log.error(`Error parsing URL: ${url} - ${error.message}`);
        return null;
    }
}

export function isWolJwOrg(parsedUrl) {
    return parsedUrl?.host === 'wol.jw.org';
}

export function isUrlStrInWolJwOrg(url) {
    const parsedUrl = parseUrl(url);
    return parsedUrl ? isWolJwOrg(parsedUrl) : false;
}

export function isValidWolBibleBookUrl(url) {
    log.debug(`Checking if URL is a valid WOL Bible book URL: ${url}`);
    const parsedUrl = parseUrl(url);
    if (!parsedUrl) {
        log.warn(`Failed to parse URL: ${url}`);
        return false;
    }
    if (!isWolJwOrg(parsedUrl)) {
        log.debug(`URL is not from wol.jw.org, skipping: ${url}`);
        return false;
    }
    const {pathParts} = parsedUrl;
    log.debug(`Parsed URL path parts:`, pathParts);

    if (pathParts.length !== 9 || pathParts[0] !== '' || pathParts[1].length !== 2 ||
        !pathParts[pathParts.length - 4].startsWith('lp') || pathParts[pathParts.length - 3] !== 'nwtsty' ||
        !/^\d+$/.test(pathParts[pathParts.length - 2]) || !/^\d+$/.test(pathParts[pathParts.length - 1])) {

        log.warn(`Invalid WOL Bible book URL structure: ${url}`);
        return false;
    }

    log.info(`URL is a valid WOL Bible book URL: ${url}`);
    return true;
}