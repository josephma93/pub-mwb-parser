import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {getCheerioSelectionOrThrow, withErrorHandling} from "../core/util.mjs";
import {
    buildAnchorRefExtractionData,
    detectReferenceDataType,
    fetchAnchorReferenceData, fetchAndParseAnchorReferenceOrThrow,
    isJsonContentAcceptableForReferenceExtraction
} from "./tooltip_data_retriever.mjs";
import CONSTANTS from "../core/constants.mjs";
import {cleanText} from "../core/reference_text_parser.mjs";

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
    function extractBookNameFromTooltipCaption(caption) {
        const pattern = /^(.*?)(?=\d+:)/;
        const match = caption.match(pattern);

        if (match) {
            return match[1].trim();
        } else {
            return caption;
        }
    }

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

/**
 * @typedef {Object} TalkPoint
 * @property {string} text - The main text associated with the point.
 * @property {number[]} footnotes - An array of numerically unique integers referencing footnotes.
 */

/**
 * @typedef {Object} TenMinTalkData
 * @property {string} heading - The heading for the section.
 * @property {TalkPoint[]} points - An array of points, each containing text and associated footnotes.
 * @property {Object<number, string>} footnotes - An object containing footnotes indexed by a numerically unique key.
 */

/**
 * @param {Cheerio} tenMinTalkElement
 * @returns {TenMinTalkData}
 */
async function extractTenMinTalk(tenMinTalkElement) {
    const result = {
        heading: cleanText(tenMinTalkElement.find(`h3`).text()),
        points: [],
        footnotes: {},
    };

    const $points = tenMinTalkElement.find(`> div > p`);

    let footnoteKey = 0;
    for (let i = 0; i < $points.length; i++) {
        const $point = $points.eq(i);
        const talkPoint = {
            text: '',
            footnotes: [],
        };
        let pointText = cleanText($point.text());
        const $references = $point.find(`a`);

        for (let j = 0; j < $references.length; j++) {
            const $ref = $references.eq(j);
            const refText = cleanText($ref.text());
            pointText = pointText.replace(refText, `${refText}[^${++footnoteKey}]`);
            const [err, refData] = await fetchAndParseAnchorReferenceOrThrow($ref);
            if (err) {
                throw err;
            }
            result.footnotes[footnoteKey] = refData.parsedContent;
            talkPoint.footnotes.push(footnoteKey);
        }

        talkPoint.text = pointText;
        result.points.push(talkPoint);
    }

    return result;
}

async function _extractFullWeekProgram(html) {
    function buildRelevantProgramGroupSelections(cheerioParsed) {
        let msg = '';
        const fieldMinistryHeadline = cheerioParsed(CONSTANTS.FIELD_MINISTRY_HEADLINE_CSS_SELECTOR);
        const christianLivingHeadline = cheerioParsed(CONSTANTS.CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR);
        if (fieldMinistryHeadline.find(`> h2`).length !== 1 && christianLivingHeadline.find(`> h2`).length !== 1) {
            msg = `Unexpected number of elements for field ministry and christian living.`;
            log.error(msg);
            throw new Error(msg);
        }

        function assertForH3OrThrow(selection) {
            if (!selection.is(`h3`)) {
                msg = `Unexpected element detected. Expected h3, got ${selection[0].name}`;
                log.error(msg);
                throw new Error(msg);
            }
        }

        const middleSong = cheerioParsed(CONSTANTS.MIDDLE_SONG_CSS_SELECTOR);
        const finalSong = cheerioParsed(CONSTANTS.FINAL_SONG_CSS_SELECTOR);
        assertForH3OrThrow(middleSong);
        assertForH3OrThrow(finalSong);

        const tenMinTalk = cheerioParsed(CONSTANTS.TEN_MIN_TALK_CSS_SELECTOR);
        const points2and3 = tenMinTalk.nextUntil(fieldMinistryHeadline);
        if (points2and3.length !== 4) {
            msg = `Unexpected number of elements for points 2 and 3. Expected 4, got ${points2and3.length}`;
            log.error(msg);
            throw new Error(msg);
        }
        const spiritualGems = points2and3.slice(0, 2);
        const bibleRead = points2and3.slice(2, 4);
        const fieldMinistry = fieldMinistryHeadline.nextUntil(christianLivingHeadline);
        const bibleStudyHeadline = finalSong.prevAll('h3').first();
        assertForH3OrThrow(bibleStudyHeadline);
        let christianLiving = middleSong.nextUntil(bibleStudyHeadline);
        const precedingSiblings = finalSong.prevUntil(bibleStudyHeadline);
        const bibleStudy = precedingSiblings.add(bibleStudyHeadline);

        return {
            introduction: cheerioParsed(CONSTANTS.INTRODUCTION_CSS_SELECTOR),
            tenMinTalk,
            spiritualGems,
            bibleRead,
            fieldMinistry,
            middleSong,
            christianLiving,
            bibleStudy,
            finalSong,
        };
    }
    const cheerioParsed = cheerio.load(html);

    const weekDateSpan = extractWeekDateSpan(cheerioParsed);
    const programGroups = buildRelevantProgramGroupSelections(cheerioParsed);
    const [
        bibleRead,
        tenMinTalk,
    ] = await Promise.all([
        extractBibleRead(cheerioParsed),
        extractTenMinTalk(programGroups.tenMinTalk),
    ]).catch(err => {
        throw err;
    });

    return {
        weekDateSpan,
        bibleRead,
        tenMinTalk,
    }
}

/**
 * Extracts the full week's program from the given HTML content.
 * @param {string} html - The HTML content to parse.
 * @returns {Promise<[Error | null, ReturnType<_extractFullWeekProgram> | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is the full week's program (or null if an error occurred).
 */
export const extractFullWeekProgram = withErrorHandling(_extractFullWeekProgram);
