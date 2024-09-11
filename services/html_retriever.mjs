import {withErrorHandling} from "./support/util.mjs";
import CONSTANTS from '../core/constants.mjs';
import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {getHtmlContent} from "./support/retrievers.mjs";

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
 * Fetches this week's meeting HTML from the WOL website.
 * @returns {Promise<string | Error>} A promise that resolves to either the HTML content as a string or
 *     an Error object if any error occurs.
 */
async function _fetchThisWeekMeetingHtml() {
    let [err, html] = await fetchLandingHtml();
    if (err) {
        return err;
    }

    log.debug("Parsing base HTML");
    const $ = cheerio.load(html);

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
    [err, html] = await getHtmlContent(todayHtmlUrl);
    if (err) {
        return err;
    }
    return html;
}

/**
 * Fetches this week's meeting HTML from the WOL website with error handling.
 * @returns {Promise<SuccessTuple<string> | ErrorTuple>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is html content (or null if an error occurred).
 * @see _fetchThisWeekMeetingHtml
 */
export const fetchThisWeekMeetingHtml = withErrorHandling(_fetchThisWeekMeetingHtml);
