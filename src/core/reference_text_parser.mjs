import * as cheerio from 'cheerio';
import {cleanText, collapseConsecutiveLineBreaks} from "./util.mjs";

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
    return cleanText($.text())
        .replaceAll(/(\s\n|\n\s)/g, '\n');
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