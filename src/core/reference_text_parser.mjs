import * as cheerio from 'cheerio';

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

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parsePubW(content) {
    const $ = cheerio.load(content);
    return $('p.sb').map((i, el) => {
        const $el = $(el);
        $el.find(`.parNum`).remove();
        return cleanText($el.text());
    }).get().join('\n');
}

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parsePubNwtsty(content) {
    const $ = cheerio.load(content);
    $('a.fn, a.b').remove();
    $('.sl, .sz').each((i, el) => {
        $(el).append(`<span> </span>`);
    })
    return cleanText($.text());
}

/**
 * @param {string} content - The HTML content to parse.
 * @returns {string} The text parsed.
 */
export function parseDefault(content) {
    const $ = cheerio.load(content);
    return collapseConsecutiveLineBreaks(cleanText($.text()));
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