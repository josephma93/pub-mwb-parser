import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {getCheerioSelectionOrThrow, withErrorHandling} from "../core/util.mjs";
import {
    buildAnchorRefExtractionData,
    detectReferenceDataType,
    fetchAnchorReferenceData,
    isJsonContentAcceptableForReferenceExtraction
} from "./tooltip_data_retriever.mjs";
import CONSTANTS from "../core/constants.mjs";

const log = logger.child(logger.bindings());

/**
 * Extracts the week date span text from the given HTML content.
 * @param {string | ReturnType<cheerio.CheerioAPI.load>} cheerioOrHtml - The HTML content to parse, or a Cheerio object.
 * @returns {string} The extracted week date span text in lower case.
 * @throws {Error} If no element is found for the given selector.
 */
export function extractWeekDateSpan(cheerioOrHtml) {
    let $ = typeof cheerioOrHtml === 'string' ? cheerio.load(cheerioOrHtml) : cheerioOrHtml;
    const $el = getCheerioSelectionOrThrow($, '#p1');
    return $el.text().toLowerCase();
}

function extractBookNameFromTooltipCaption(caption) {
    const pattern = /^(.*?)(?=\d+:)/;
    const match = caption.match(pattern);

    if (match) {
        return match[1].trim();
    } else {
        return caption;
    }
}

/**
 * @typedef {Object} WeeklyBibleyStudyAssignement
 * @property {string} bookName - The name of the book.
 * @property {number} bookNumber - The number assigned to the book.
 * @property {number} firstChapter - The first chapter assigned to be read.
 * @property {number} lastChapter - The last chapter assigned to be read.
 * @property {string[]} links - An array of URLs or references associated with the book.
 */

/**
 * Extracts the bible read data from the given HTML content.
 * @param {string | ReturnType<cheerio.CheerioAPI.load>} cheerioOrHtml - The HTML content to parse, or a Cheerio object.
 * @returns {Promise<Error | WeeklyBibleyStudyAssignement>} A promise that resolves to the extracted bible read data.
 */
export async function extractBibleRead(cheerioOrHtml) {
    let $ = typeof cheerioOrHtml === 'string' ? cheerio.load(cheerioOrHtml) : cheerioOrHtml;
    const $selection = getCheerioSelectionOrThrow($, '#p2 a');

    const result = {
        bookName: "",
        bookNumber: 0,
        firstChapter: 0,
        lastChapter: 0,
        links: [],
    };

    let urlPathForLinks = '';
    for (let i = 0; i < $selection.length; i++) {
        const $anchor = $selection.eq(i);
        const anchorRefExtractionData = buildAnchorRefExtractionData($anchor);

        const [err, json] = await fetchAnchorReferenceData(anchorRefExtractionData);
        if (err) {
            throw err;
        }

        if (!isJsonContentAcceptableForReferenceExtraction(json)) {
            throw new Error(`JSON content for reference doesn't match the expected format.`);
        }
        const [rawFetchedData] = json.items;
        const detectedReferenceDataTypes = detectReferenceDataType(rawFetchedData);

        if (!detectedReferenceDataTypes.isPubNwtsty) {
            throw new Error(`Unexpected anchor reference data extracted from anchor element`);
        }

        if (urlPathForLinks === '') {
            urlPathForLinks = rawFetchedData.url;
            result.bookNumber = rawFetchedData.book;
            result.bookName = extractBookNameFromTooltipCaption(rawFetchedData.caption);
            result.firstChapter = rawFetchedData.first_chapter;
            result.lastChapter = rawFetchedData.last_chapter;
        }

        result.firstChapter = Math.min(result.firstChapter, rawFetchedData.first_chapter);
        result.lastChapter = Math.max(result.lastChapter, rawFetchedData.last_chapter);
    }

    const languageCode = buildAnchorRefExtractionData($selection.eq(0)).sourceHref.slice(0, 3);
    for (let chapter = result.firstChapter; chapter <= result.lastChapter; chapter++) {
        const urlPathParts = urlPathForLinks.split('/');
        urlPathParts[urlPathParts.length - 1] = chapter;
        let joinedUrlPath = urlPathParts.join('/');
        result.links.push(`${CONSTANTS.BASE_URL}${languageCode}${joinedUrlPath}`);
    }

    return result;
}

async function _extractFullWeekProgram(html) {
    const cheerioParsed = cheerio.load(html);

    const weekDateSpan = extractWeekDateSpan(cheerioParsed);
    const [
        bibleRead
    ] = await Promise.all([
        extractBibleRead(cheerioParsed),
    ]).catch(err => {
        throw err;
    });

    return {
        weekDateSpan,
        bibleRead,
    }
}

/**
 * Extracts the full week's program from the given HTML content.
 * @param {string} html - The HTML content to parse.
 * @returns {Promise<[Error | null, ReturnType<_extractFullWeekProgram> | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is the full week's program (or null if an error occurred).
 */
export const extractFullWeekProgram = withErrorHandling(_extractFullWeekProgram);
