import {withErrorHandling} from "../core/util.mjs";
import CONSTANTS from '../core/constants.mjs';
import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {getHtmlContent} from "../core/retrievers.mjs";

const log = logger.child(logger.bindings());

/**
 * Fetches the landing HTML from the WOL website.
 * @returns {Promise<Error | string>} A promise that resolves to an Error object if any error occurs,
 *     or the HTML content as a string if successful.
 */
async function _fetchLandingHtml() {
    const baseUrl = CONSTANTS.BASE_URL;

    log.info(`Fetching landing HTML from [${baseUrl}]`);
    let [err, strOrNull] = await getHtmlContent(baseUrl);
    if (err) {
        return err;
    }
    /** @type {string} */
    let html = strOrNull;

    const $ = cheerio.load(html);
    const selector = 'link[hreflang="es"]';
    const hrefLangEs = $(selector).attr('href');
    log.debug(`Value for hrefLangEs: [${hrefLangEs}]`);

    if (!hrefLangEs) {
        log.error(`No href found for [${selector}]`);
        return new Error("No href found, website structure may have changed");
    }

    const landingForLanguage = `${baseUrl}${hrefLangEs}`;
    log.info(`Fetching HTML content from [${landingForLanguage}]`);
    [err, html] = await getHtmlContent(landingForLanguage);
    if (err) {
        return err;
    }
    /** @type {string} */
    html = strOrNull;

    return html;
}

/**
 * Fetches the landing HTML from the WOL website with error handling.
 * @returns {Promise<[Error | null, string | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is html content (or null if an error occurred).
 * @see _fetchLandingHtml
 */
export const fetchLandingHtml = withErrorHandling(_fetchLandingHtml);

/**
 * Fetches this week's meeting HTML from the WOL website, given the base HTML content if provided or by fetching
 * the landing HTML as a default.
 * @param {string} [baseHtml] - The base HTML content to parse.
 *      If not provided, the landing HTML will be fetched and used as the default value.
 * @returns {Promise<string | Error>} A promise that resolves to either the HTML content as a string or
 *     an Error object if any error occurs.
 */
async function _fetchThisWeekMeetingHtml(baseHtml) {
    if (!baseHtml) {
        log.debug("Base HTML missing, fetching landing HTML as default");
        const [err, strOrNull] = await fetchLandingHtml();
        if (err) {
            return err;
        }
        /** @type {string} */
        baseHtml = strOrNull;
    }

    log.debug("Parsing base HTML");
    const $ = cheerio.load(baseHtml);

    log.debug("Selecting today's navigation link");
    const selector = '#menuToday .todayNav';
    const todayNav = $(selector).attr('href');
    log.debug(`Value for href: [${todayNav}]`);
    if (!todayNav) {
        log.warn(`No href found for [${selector}]`);
        return new Error("No href found, website structure may have changed");
    }

    const todayHtmlUrl = CONSTANTS.BASE_URL + todayNav;
    log.info(`Fetching today's HTML content from [${todayHtmlUrl}]`);
    let [err, strOrNull] = await getHtmlContent(todayHtmlUrl);
    if (err) {
        return err;
    }
    return strOrNull;
}

/**
 * Fetches this week's meeting HTML from the WOL website with error handling.
 * @param {string} [baseHtml] - The base HTML content to parse.
 *      If not provided, the landing HTML will be fetched and used as the default value.
 * @returns {Promise<[Error | null, string | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is html content (or null if an error occurred).
 * @see _fetchThisWeekMeetingHtml
 */
export const fetchThisWeekMeetingHtml = withErrorHandling(_fetchThisWeekMeetingHtml);

/**
 * Extracts the URL of the weekly watchtower article from the given HTML content of this week's meeting program.
 * @param {string} [thisWeekMeetingProgram] - The HTML content of this week's meeting program.
 *     If not provided, the HTML content will be fetched and used as the default value.
 * @returns {Promise<string | Error>} A promise that resolves to either a string containing the path of the URL of the
 *      weekly watchtower article, or an Error if the extraction fails.
 */
async function _extractWatchtowerArticleUrl(thisWeekMeetingProgram) {
    if (!thisWeekMeetingProgram) {
        log.debug("This week's HTML missing, fetching this week's HTML as default");
        const [err, html] = await fetchThisWeekMeetingHtml();
        if (err) {
            return err;
        }
        /** @type {string} */
        thisWeekMeetingProgram = html;
    }
    log.debug("Parsing this week's HTML");
    const $ = cheerio.load(thisWeekMeetingProgram);
    const selector = '.todayItem.pub-w:nth-child(2) .itemData a';

    const pubWItem = $(selector).attr('href');
    log.debug(`Value for href: [${pubWItem}]`);
    if (!pubWItem) {
        log.error(`No href found for ${selector}`);
        return new Error("No href found, website structure may have changed");
    }

    return `${CONSTANTS.BASE_URL}${pubWItem}`;
}

/**
 * Extracts the URL of the weekly watchtower article from the given HTML content of
 * this week's meeting program.
 * @param {string} [thisWeekMeetingProgram] - The HTML content of this week's meeting program.
 *      If the HTML content is not provided, it will be fetched from the WOL website.
 * @returns {Promise<[Error | null, string | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is the URL of the weekly
 *      watchtower article (or null if an error occurred).
 * @see _extractWatchtowerArticleUrl
 */
const extractWatchtowerArticleUrl = withErrorHandling(_extractWatchtowerArticleUrl);

/**
 * Fetches the weekly Watchtower article HTML from the WOL website, using the provided meeting
 * program HTML content or fetching the default landing page if not provided.
 * @param {string} [thisWeekMeetingProgram] - The HTML content of this week's meeting program.
 *     If not provided, the function fetches the default weekly meeting HTML.
 * @returns {Promise<Error | string>} A promise that resolves to the HTML content as a string,
 *     or an Error object if an error occurs during the process.
 */
export async function _fetchThisWeekWatchtowerArticleHtml(thisWeekMeetingProgram) {
    let [err, watchtowerArticleUrl] = await extractWatchtowerArticleUrl(thisWeekMeetingProgram);
    if (err) {
        return err;
    }

    log.info(`Fetching weekly HTML content from [${watchtowerArticleUrl}]`);
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
        log.error(`No article found for [${selector}]`);
        return new Error("No article found, website structure may have changed");
    }

    log.info(`Successfully fetched and extracted this week's watchtower article HTML from [${watchtowerArticleUrl}]`);
    return article.html();
}

/**
 * Fetches the weekly Watchtower article HTML with error handling.
 * @param {string} [thisWeekMeetingProgram] - The HTML content of this week's meeting program.
 * @returns {Promise<[Error | null, string | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is html content (or null if an error occurred).
 * @see _fetchThisWeekWatchtowerArticleHtml
 */
export const fetchThisWeekWatchtowerArticleHtml = withErrorHandling(_fetchThisWeekWatchtowerArticleHtml);
