import * as cheerio from 'cheerio';

/**
 * Trims, and removes all non-breaking space characters from the given text.
 * @param {any} txt
 * @returns {string} Cleaned text or empty string if the given value is not a string.
 */
export function cleanText(txt) {
    return (typeof txt === 'string' ? txt : '').trim().replaceAll(' ', ' ');
}

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parsePubW(content) {
    const $ = cheerio.load(content);
    return $('p.sb').map((i, el) => cleanText($(el).text()).trim()).get().join('\n');
}

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parsePubNwtsty(content) {
    const $ = cheerio.load(content);
    $('a.fn, a.b').remove();
    return cleanText($.text());
}

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parseDefault(content) {
    const $ = cheerio.load(content);
    return cleanText($.text()).replaceAll(/\n+/g, '\n');
}

/**
 * @param {PublicationRefDetectionData} contentDetectionData
 * @param {string} contentToParse
 * @returns {string}
 */
export function pickAndApplyParsingLogic({isPubW, isPubNwtsty}, contentToParse) {
    /** @type {function(string): string} */
    let parserStrategy;

    if (isPubW) {
        parserStrategy = parsePubW;
    } else if (isPubNwtsty) {
        parserStrategy = parsePubNwtsty;
    } else {
        parserStrategy = parseDefault;
    }

    return parserStrategy(contentToParse);
}