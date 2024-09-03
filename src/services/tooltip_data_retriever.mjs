import logger from "../core/logger.mjs";
import CONSTANTS from "../core/constants.mjs";
import {withErrorHandling} from "../core/util.mjs";
import {getJsonContent} from "../core/retrievers.mjs";
import {pickAndApplyParsingLogic} from "../core/reference_text_parser.mjs";

const log = logger.child(logger.bindings());

/**
 * @typedef {Object} AnchorRefExtractionData
 * @property {string} sourceHref - The URL path string extracted from the anchor element.
 * @property {string} fetchUrl - The full URL constructed from the base URL and the sourceHref.
 */

/**
 * Builds an object containing the source href and the URL to fetch the referenced data, given a cheerio element.
 * @param {Cheerio} $el - The cheerio element from which to extract the data.
 * @returns {AnchorRefExtractionData} An object containing the source href and the URL to fetch.
 */
export function buildAnchorRefExtractionData($el) {
    const sourceHref = $el.attr('href');
    const fetchUrl = `${CONSTANTS.BASE_URL}${sourceHref.slice(3)}`;
    return {
        sourceHref,
        fetchUrl,
    };
}

/**
 * Fetches the JSON content from the WOL website given the anchor reference extraction data.
 * @param {AnchorRefExtractionData} anchorRefExtractionData - An object containing the source href and the URL to fetch the referenced data.
 * @returns {Promise<Error | Object>} A promise that resolves to either an Error object if any error occurs, or the JSON content if successful.
 */
async function _fetchAnchorReferenceData(anchorRefExtractionData) {
    const {fetchUrl} = anchorRefExtractionData;
    const [err, json] = await getJsonContent(fetchUrl);
    if (err) {
        return err;
    }
    return json;
}

/**
 * @typedef {Object} BasePublicationItem
 * @property {string} title - The title of the publication or passage.
 * @property {string} url - The URL to the publication or passage.
 * @property {string} caption - The caption associated with the item (can be empty).
 * @property {string} content - The HTML content of the item.
 * @property {string} articleClasses - CSS classes applied to the article.
 * @property {string} reference - Reference text, if any.
 * @property {string[]} categories - Categories associated with the item, e.g., ["it"] for Insight or ["w"] for Watchtower.
 * @property {string} pubType - The publication type (can be empty).
 * @property {string} publicationTitle - The title of the publication.
 */

/**
 * @typedef {BasePublicationItem} BiblicalPassageItem
 * @property {number} book - The book number.
 * @property {number} first_chapter - The first chapter number.
 * @property {number} first_verse - The first verse number.
 * @property {number} last_chapter - The last chapter number.
 * @property {number} last_verse - The last verse number.
 */

/**
 * @typedef {Object} BasePublicationResponse
 * @property {string} title - The title of the response section.
 */

/**
 * @typedef {BasePublicationResponse} BiblicalPassageResponse
 * @property {BiblicalPassageItem[]} items - An array of items containing details about the Biblical passage.
 */

/**
 * @typedef {BasePublicationResponse} DefaultResponse
 * @property {BasePublicationItem[]} items - An array of items containing details about a WOL publication.
 */

/**
 * Fetches the JSON content from the WOL website given the anchor reference extraction data.
 * @param {AnchorRefExtractionData} anchorRefExtractionData - An object containing the source href and the URL to fetch the referenced data.
 * @returns {Promise<ErrorTuple | SuccessTuple<DefaultResponse | BiblicalPassageResponse>>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is the JSON content (or null if an error occurred).
 */
export const fetchAnchorReferenceData = withErrorHandling(_fetchAnchorReferenceData);

/**
 * Checks if the JSON fetched from the WOL website's is acceptable for reference extraction.
 * @param {Object} json The JSON content to check.
 * @returns {boolean} True if the JSON content is acceptable for reference extraction, false otherwise.
 */
export function isJsonContentAcceptableForReferenceExtraction(json) {
    let isValid = true;
    if (!Array.isArray(json.items) && json.items.length !== 1) {
        log.error(`JSON content doesn't contain exactly one item. JSON content: ${JSON.stringify(json)}`);
        isValid = false;
    }
    const [itemData] = json.items;
    if (typeof itemData.content !== 'string' || !itemData.content) {
        log.error(`JSON content doesn't contain content. JSON content: ${JSON.stringify(json)}`);
        isValid = false;
    }

    if (typeof itemData.articleClasses !== 'string' || !itemData.articleClasses) {
        log.error(`JSON content doesn't contain articleClasses. JSON content: ${JSON.stringify(json)}`);
        isValid = false;
    }

    return isValid;
}

/**
 * @typedef {Object} PublicationRefDetectionData
 * @property {boolean} isPubW - Indicates if the publication is of type W.
 * @property {boolean} isPubNwtsty - Indicates if the publication is of type NWTSTY.
 */

/**
 * @param itemData
 * @returns {PublicationRefDetectionData}
 */
export function detectReferenceDataType(itemData) {
    const articleClasses = itemData.articleClasses;

    const isPubW = new RegExp(`\\b${CONSTANTS.PUB_CODE_WATCHTOWER}\\b`, 'i').test(articleClasses);
    const isPubNwtsty = new RegExp(`\\b${CONSTANTS.PUB_CODE_BIBLE}\\b`, 'i').test(articleClasses);

    return {
        isPubW,
        isPubNwtsty,
    }
}

/**
 * @typedef {PublicationRefDetectionData} PublicationRefData
 * @property {string} parsedContent - The parsed content as a string.
 */

/**
 * Builds a PublicationRefData object from the given raw reference data.
 * @param {Object} rawReferenceData A JSON object that meets expected parsing requirements.
 * @returns {PublicationRefData} The parsed reference data.
 */
export function buildPublicationRefData(rawReferenceData) {
    const contentDetectionData = detectReferenceDataType(rawReferenceData);
    const parsedContent = pickAndApplyParsingLogic(contentDetectionData, rawReferenceData.content);

    return {
        ...contentDetectionData,
        parsedContent,
    };
}

/**
 * Attempts to parse the given JSON content fetched from an anchor reference
 * by detecting the type of publication and applying the corresponding parser
 * strategy.
 *
 * @param {Object} fetchedReferenceJson - The JSON content fetched from the anchor reference.
 * @returns {PublicationRefData} The parsed publication information.
 * @throws {Error} If the JSON content doesn't match the expected format.
 */
function parseAnchorRefDataOrThrow(fetchedReferenceJson) {
    if (!isJsonContentAcceptableForReferenceExtraction(fetchedReferenceJson)) {
        throw new Error(`JSON content for reference doesn't match the expected format.`);
    }
    const [itemData] = fetchedReferenceJson.items;
    return buildPublicationRefData(itemData);
}

/**
 * Fetches an anchor reference data and attempts to parse it.
 * @param {ReturnType<CheerioAPI>} $anchor - The cheerio element for the anchor reference to fetch.
 * @returns {Promise<Error | PublicationRefData>}
 *     A promise that resolves to a tuple where the first element is an Error object
 *     (or null if no error occurred) and the second element is the parsed content.
 * @throws {Error} If the JSON content doesn't match the expected format.
 */
async function _fetchAndParseAnchorReferenceOrThrow($anchor) {
    const anchorRefExtractionData = buildAnchorRefExtractionData($anchor);
    const [err, json] = await fetchAnchorReferenceData(anchorRefExtractionData);
    if (err) {
        return err;
    }

    const parsed = parseAnchorRefDataOrThrow(json);
    log.debug(`Parsed anchor reference data for [${$anchor.text()}] and anchor reference [${$anchor.text()}]: ${JSON.stringify(parsed)}`);
    return parsed;
}

/**
 * Fetches an anchor reference data and attempts to parse it.
 * @param {Cheerio} $anchor - The cheerio element for the anchor reference to fetch.
 * @returns {Promise<ErrorTuple | SuccessTuple<PublicationRefData>>}
 *     A promise that resolves to a tuple where the first element is an Error object
 *     (or null if no error occurred) and the second element is the parsed content.
 * @throws {Error} If the JSON content doesn't match the expected format.
 */
export const fetchAndParseAnchorReferenceOrThrow = withErrorHandling(_fetchAndParseAnchorReferenceOrThrow);
