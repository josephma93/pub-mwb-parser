import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {
    cleanText,
    collapseConsecutiveLineBreaks,
    getCheerioSelectionOrThrow,
    withErrorHandling
} from "../core/util.mjs";
import {
    buildAnchorRefExtractionData,
    detectReferenceDataType,
    fetchAnchorReferenceData,
    fetchAndParseAnchorReferenceOrThrow,
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
 * Finds and extracts the time box number from the given selection.
 * @param {Cheerio} $selection
 * @returns {number}
 * @throws {Error} If time box is not found.
 */
function getTimeBoxFromElement($selection) {
    const msg = `No selection found for selector [${CONSTANTS.LINE_WITH_TIME_BOX_CSS_SELECTOR}]`;
    let $lineWithTimeBox = $selection.find(CONSTANTS.LINE_WITH_TIME_BOX_CSS_SELECTOR);
    if (!$lineWithTimeBox.length) {
        log.error(msg);
        throw new Error(msg);
    }

    const timeMatch = cleanText($lineWithTimeBox.text()).match(/\((\d+)\s*mins?\.\)/);
    if (timeMatch) {
        return parseInt(timeMatch[1], 10);
    }

    log.error(msg);
    throw new Error(msg);
}

/**
 * @typedef {Object} TalkPoint
 * @property {string} text - The main text associated with the point.
 * @property {number[]} footnotes - An array of numerically unique integers referencing footnotes.
 */

/**
 * @typedef {Object} TenMinTalkData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
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
        sectionNumber: 1,
        timeBox: getTimeBoxFromElement(tenMinTalkElement),
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

/**
 * @typedef {Object} AnswerSource
 * @property {string} contents - The detailed content for the answer.
 * @property {string} mnemonic - The reference or mnemonic for the content.
 */

/**
 * @typedef {Object} PrintedQuestion
 * @property {AnswerSource[]} answerSources - An array of sources containing content and mnemonics.
 * @property {string} question - The printed question.
 * @property {string} scriptureContents - The scripture text associated with the question.
 * @property {string} scriptureMnemonic - The scripture reference or mnemonic.
 */

/**
 * @typedef {Object} SpiritualGemsData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {PrintedQuestion} printedQuestionData - The printed question details, including answer sources and scripture references.
 * @property {string} openEndedQuestion - The open-ended question text.
 */


/**
 * @param {Cheerio} spiritualGems
 * @returns {SpiritualGemsData}
 * @throws {Error}
 */
async function extractSpiritualGems(spiritualGems) {
    const $content = spiritualGems.eq(1);

    const printedQuestionData = {
        sectionNumber: 2,
        timeBox: getTimeBoxFromElement($content),
        scriptureMnemonic: '',
        scriptureContents: '',
        question: '',
        answerSources: [],
    };

    const $scriptureAnchorSelection = $content.find(`a.b`);
    if ($scriptureAnchorSelection.length !== 1) {
        const msg = `Unexpected number of elements for scripture anchor.`;
        log.error(msg);
        throw new Error(msg);
    }

    printedQuestionData.scriptureMnemonic = cleanText($scriptureAnchorSelection.text());
    let [err, json] = await fetchAndParseAnchorReferenceOrThrow($scriptureAnchorSelection);
    if (err) {
        throw err;
    }
    printedQuestionData.scriptureContents = json.parsedContent;

    printedQuestionData.question = $scriptureAnchorSelection.parent()
        .contents()
        .filter(function () {
            return this.nodeType === 3 /* TEXT_NODE */
        })
        .eq(0)
        .text()
        .slice(2, -2);

    const $answerSelection = $content.find(`a`).slice(1); // Skip the first element, which is the scripture reference.

    for (let i = 0; i < $answerSelection.length; i++) {
        const $answer = $answerSelection.eq(i);
        [err, json] = await fetchAndParseAnchorReferenceOrThrow($answer);
        if (err) {
            throw err;
        }
        printedQuestionData.answerSources.push({
            contents: json.parsedContent,
            mnemonic: cleanText($answer.text()),
        });
    }

    return {
        printedQuestionData,
        openEndedQuestion: cleanText($content.find(`li.du-margin-top--8 p`).text()),
    };
}

/**
 * @typedef {Object} StudyPoint
 * @property {string} contents - The content of the study point.
 * @property {string} mnemonic - The mnemonic or reference for the study point.
 */

/**
 * @typedef {Object} BibleReadData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {string} scriptureMnemonic - A mnemonic or reference for the scripture passage.
 * @property {string} scriptureContents - The full text of the scripture passage.
 * @property {StudyPoint} studyPoint - The details of the study point associated with the study lesson.
 */

/**
 * @param {Cheerio} bibleRead
 * @returns {BibleReadData}
 */
async function extractBibleReading(bibleRead) {
    const $content = bibleRead.eq(1);
    const result = {
        sectionNumber: 3,
        timeBox: getTimeBoxFromElement($content),
        scriptureMnemonic: '',
        scriptureContents: '',
        studyPoint: {
            mnemonic: '',
            contents: '',
        },
    };

    const $anchorSelection = $content.find(`a`);
    if ($anchorSelection.length !== 2) {
        const msg = `Unexpected number of elements for bible reading anchor.`;
        log.error(msg);
        throw new Error(msg);
    }

    const $scriptureAnchor = $anchorSelection.eq(0);
    const $studyPointAnchor = $anchorSelection.eq(1);
    let [err, json] = await fetchAndParseAnchorReferenceOrThrow($scriptureAnchor);
    if (err) {
        throw err;
    }
    result.scriptureMnemonic = cleanText($scriptureAnchor.text());
    result.scriptureContents = json.parsedContent;
    result.studyPoint.mnemonic = cleanText($studyPointAnchor.text());
    [err, json] = await fetchAndParseAnchorReferenceOrThrow($studyPointAnchor);
    if (err) {
        throw err;
    }
    result.studyPoint.contents = json.parsedContent;

    return result;
}

/**
 * Extracts the section number from the given element's text.
 * @param {Cheerio} $element
 * @returns {number}
 * @throws {Error} If the element's text doesn't match the expected format.
 */
function getSectionNumberFromElement($element) {
    const elementText = cleanText($element.text());
    if (!/^\d\./.test(elementText)) {
        const msg = `Unexpected section number for element [${elementText}].`;
        log.error(msg);
        throw new Error(msg);
    }
    return parseInt(elementText.split('.')[0], 10);
}

/**
 * @typedef {Object} FieldMinistryAssignmentData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {boolean} isStudentTask - Indicates whether this is a student task.
 * @property {string} headline - The headline for the ministry task.
 * @property {string} contents - The content of the assignment task.
 * @property {StudyPoint | null} studyPoint - The study point associated with this task or null if none which means isStudentTask is false.
 */

function buildHeadlineToContentGroups(fieldMinistry, $) {
    return fieldMinistry.toArray().reduce((acc, el) => {
        const $el = $(el);

        if ($el.is('h3')) {
            acc.push({
                heading: $el,
                contents: [],
            });
        } else {
            acc.at(-1)?.contents.push($el);
        }

        return acc;
    }, []);
}

/**
 * @param {Cheerio} fieldMinistry
 * @param {cheerio.Root} $
 * @returns {FieldMinistryAssignmentData[]}
 */
async function extractFieldMinistry(fieldMinistry, $) {

    function extractBetweenParentheses(text) {
        const extractRegex = /\)\s*\s*(.*?)\s*(?=\s*\()/;
        const match = text.match(extractRegex);
        if (match) {
            return match[1];
        }
        return text;
    }

    const assignmentGroups = buildHeadlineToContentGroups(fieldMinistry, $);

    const promises = assignmentGroups.map(async ({heading, contents: [assignmentContents]}) => {
        const contentsText = cleanText(assignmentContents.text());
        const result = {
            sectionNumber: getSectionNumberFromElement(heading),
            timeBox: getTimeBoxFromElement(assignmentContents),
            // Student tasks have a time inside parentheses and a study point inside parentheses.
            isStudentTask: /\(.*?\).*?\(.*?\)/.test(contentsText),
            headline: cleanText(heading.text()).slice(3),
            contents: contentsText,
            studyPoint: null,
        };

        if (result.isStudentTask) {
            const $studyPointAnchor = assignmentContents.find(`a`).slice(-1);
            if ($studyPointAnchor.length !== 1) {
                const msg = `Unable to find study point anchor.`;
                log.error(msg);
                throw new Error(msg);
            }
            const [err, json] = await fetchAndParseAnchorReferenceOrThrow($studyPointAnchor);
            if (err) {
                throw err;
            }
            result.studyPoint = {
                mnemonic: cleanText($studyPointAnchor.text()),
                contents: json.parsedContent,
            };
            result.contents = extractBetweenParentheses(contentsText);
        }

        return result;
    });

    return await Promise.all(promises);
}

/**
 * @typedef {Object} ChristianLivingSectionData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {string} contents - The content of the ministry task.
 */

/**
 * @param {Cheerio} christianLiving
 * @param {cheerio.Root} $
 * @returns {ChristianLivingSectionData[]}
 */
function extractChristianLiving(christianLiving, $) {

    function polishElementText($el) {
        let result = $el.text();
        result = cleanText(result);
        result = collapseConsecutiveLineBreaks(result);
        return result;
    }

    function takeOutTimeBoxText(text) {
        text = text.join('\n');
        return text.split(')').slice(1).join(')').trim();
    }

    const sectionGroups = buildHeadlineToContentGroups(christianLiving, $);

    return sectionGroups.map(({heading, contents}) => {
        return {
            sectionNumber: getSectionNumberFromElement(heading),
            timeBox: getTimeBoxFromElement(contents[0]),
            contents: takeOutTimeBoxText(contents.map(polishElementText)),
        };
    });
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

        const treasuresTalk = cheerioParsed(CONSTANTS.TREASURES_TALK_CSS_SELECTOR);
        const points2and3 = treasuresTalk.nextUntil(fieldMinistryHeadline);
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
            treasuresTalk,
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
        treasuresTalk,
        spiritualGemsData,
        bibleReading,
        fieldMinistry,
        christianLiving,
    ] = await Promise.all([
        extractBibleRead(cheerioParsed),
        extractTenMinTalk(programGroups.treasuresTalk),
        extractSpiritualGems(programGroups.spiritualGems),
        extractBibleReading(programGroups.bibleRead),
        extractFieldMinistry(programGroups.fieldMinistry, cheerioParsed),
        extractChristianLiving(programGroups.christianLiving, cheerioParsed),
    ]).catch(err => {
        throw err;
    });

    return {
        weekDateSpan,
        bibleRead,
        treasuresTalk,
        spiritualGemsData,
        bibleReading,
        fieldMinistry,
        christianLiving,
    }
}

/**
 * Extracts the full week's program from the given HTML content.
 * @param {string} html - The HTML content to parse.
 * @returns {Promise<[Error | null, ReturnType<_extractFullWeekProgram> | null]>} A promise that resolves to a tuple where the first element is an
 *      Error object (or null if no error occurred) and the second element is the full week's program (or null if an error occurred).
 */
export const extractFullWeekProgram = withErrorHandling(_extractFullWeekProgram);
