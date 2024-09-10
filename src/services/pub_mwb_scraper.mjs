import * as cheerio from 'cheerio';
import logger from "../core/logger.mjs";
import {
    cleanText,
    collapseConsecutiveLineBreaks,
    getCheerioSelectionOrThrow,
} from "../core/util.mjs";
import {
    buildAnchorRefExtractionData,
    detectReferenceDataType,
    fetchAnchorData,
    fetchAnchorReferenceData,
    fetchAndParseAnchorReferenceOrThrow,
    isJsonContentAcceptableForReferenceExtraction
} from "./tooltip_data_retriever.mjs";
import CONSTANTS from "../core/constants.mjs";
import {
    getAndValidateSongSelections,
    buildGodsTreasuresSelections,
    buildFieldMinistrySelections,
    buildChristianLivingSelections,
    buildRelevantProgramGroupSelections,
} from "./pub_mwb_program_selection_groups.mjs";
import {parsePubSjj} from "../core/reference_text_parser.mjs";

const log = logger.child(logger.bindings());

/**
 * @typedef {Object} ExtractionInput
 * @property {ReturnType<cheerio.load>} [$] - A pre-parsed Cheerio object. If provided, it will be used directly for section extraction.
 * @property {string} [html] - The raw HTML string to be parsed. If provided, it will be used to create a Cheerio object.
 * @property {Cheerio} [selection] - A specific Cheerio selection (a subset of the DOM) to be used directly for extraction.
 *                                           If provided, this takes precedence over `html` and `cheerioObj`.
 * @property {function(ReturnType<cheerio.load>): Cheerio} [selectionBuilder] - A function that takes a Cheerio object and builds the expected selection.
 */

/**
 * Processes the extraction input and deals with defaults.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {ExtractionInput} The input object with the default values filled in.
 * @throws {Error} If something is wrong with the input.
 */
export function processExtractionInput({$, html, selection, selectionBuilder}) {
    // Either a cheerio object or HTML string must be provided
    if (!$ && !html) {
        const msg = 'No HTML or Cheerio object provided';
        log.error(msg);
        throw new Error(msg);
    }

    // When cheerio is missing we create it from the HTML
    if (!$) {
        $ = cheerio.load(html);
    }

    // If there is no selection, we build it if there is a selection builder
    if (!selection && selectionBuilder) {
        selection = selectionBuilder($);
    }

    // Put together an object with all values together for usage
    return {$, html, selection};
}

/**
 * Extracts the week date span text from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {string} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export function extractWeekDateSpan(input) {
    log.info("Starting to extract week date span");
    const {$} = processExtractionInput(input);
    const $el = getCheerioSelectionOrThrow($, '#p1');
    const result = $el.text().toLowerCase();
    log.info(`Extracted week date span: [${result}]`);
    return result;
}

/**
 * @typedef {Object} SongData
 * @property {number} songNumber - The song number.
 * @property {PubSjjParsedData} songData - The parsed song data.
 */

/**
 * Extracts the song data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<SongData[]>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export function extractSongData(input) {
    input.selectionBuilder = ($) => getAndValidateSongSelections($).songs;
    const {$, selection: $songsSelection} = processExtractionInput(input);
    const $songAnchors = $songsSelection.map((_, anchor) => $(anchor).find('a'));
    if ($songAnchors.length !== 3) {
        const msg = `Expected 3 song anchors, found [${$songAnchors.length}]. The document structure may have changed.`;
        log.error(msg);
        throw new Error(msg);
    }

    const promises = $songAnchors.map(async function mapAnchorToSongData(_, anchor) {
        const $anchor = $(anchor);
        const text = cleanText($anchor.text());
        const songNumber = text.match(/\d+/);
        if (!songNumber || songNumber.length !== 1) {
            const msg = `Expected song number, found [${text}]. The document structure may have changed.`;
            log.error(msg);
            throw new Error(msg);
        }

        const songNumberNumber = parseInt(songNumber[0], 10);

        const [err, songRefData] = await fetchAnchorData($anchor);
        if (err) {
            throw err;
        }

        if (!isJsonContentAcceptableForReferenceExtraction(songRefData)) {
            const msg = `The song data extracted from the tooltip is eligible for reference extraction. The document structure may have changed.`;
            log.error(msg);
            throw new Error(msg);
        }
        const [itemData] = songRefData.items;
        const songData = parsePubSjj(itemData.content);

        return {
            songNumber: songNumberNumber,
            songData,
        };
    }).toArray();

    return Promise.all(promises);
}

/**
 * @typedef {Object} WeeklyBibleReadData
 * @property {string} bookName - The name of the book.
 * @property {number} bookNumber - The number assigned to the book.
 * @property {number} firstChapter - The first chapter assigned to be read.
 * @property {number} lastChapter - The last chapter assigned to be read.
 * @property {string[]} links - An array of URLs or references associated with the book.
 */

/**
 * Extracts the bible read data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<WeeklyBibleReadData>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractWeeklyBibleRead(input) {
    function extractBookNameFromTooltipCaption(caption) {
        const pattern = /^(.*?)(?=\d+:)/;
        const match = caption.match(pattern);

        if (match) {
            return match[1].trim();
        } else {
            return caption;
        }
    }

    log.info("Starting to extract Bible read data");
    const {$} = processExtractionInput(input);
    const $anchorSelection = getCheerioSelectionOrThrow($, '#p2 a');

    const result = {
        bookName: "",
        bookNumber: 0,
        firstChapter: 0,
        lastChapter: 0,
        links: [],
    };

    let urlPathForLinks = '';
    for (let i = 0; i < $anchorSelection.length; i++) {
        const $anchor = $anchorSelection.eq(i);
        const anchorRefExtractionData = buildAnchorRefExtractionData($anchor);
        log.debug(`Processing anchor at index [${i}], anchorRefExtractionData: [${JSON.stringify(anchorRefExtractionData)}]`);

        const [err, json] = await fetchAnchorReferenceData(anchorRefExtractionData);
        if (err) {
            throw err;
        }

        if (!isJsonContentAcceptableForReferenceExtraction(json)) {
            const msg = `JSON content for reference doesn't match the expected format.`;
            log.error(msg);
            throw new Error(msg);
        }
        const [rawFetchedData] = json.items;
        const detectedReferenceDataTypes = detectReferenceDataType(rawFetchedData);
        log.debug(`Detected reference data types: [${JSON.stringify(detectedReferenceDataTypes)}]`);

        if (!detectedReferenceDataTypes.isPubNwtsty) {
            const msg = `Unexpected anchor reference data extracted from anchor element`;
            log.error(msg);
            throw new Error(msg);
        }

        if (urlPathForLinks === '') {
            urlPathForLinks = rawFetchedData.url;
            result.bookNumber = rawFetchedData.book;
            result.bookName = extractBookNameFromTooltipCaption(rawFetchedData.caption);
            result.firstChapter = rawFetchedData.first_chapter;
            result.lastChapter = rawFetchedData.last_chapter;
            log.info(`Initialized result with first data: [${JSON.stringify(result)}]`);
        }

        result.firstChapter = Math.min(result.firstChapter, rawFetchedData.first_chapter);
        result.lastChapter = Math.max(result.lastChapter, rawFetchedData.last_chapter);
        log.debug(`Updated chapters: firstChapter=[${result.firstChapter}], lastChapter=[${result.lastChapter}]`);
    }

    const languageCode = buildAnchorRefExtractionData($anchorSelection.eq(0)).sourceHref.slice(0, 3);
    for (let chapter = result.firstChapter; chapter <= result.lastChapter; chapter++) {
        const urlPathParts = urlPathForLinks.split('/');
        urlPathParts[urlPathParts.length - 1] = chapter;
        let joinedUrlPath = urlPathParts.join('/');
        result.links.push(`${CONSTANTS.BASE_URL}${languageCode}${joinedUrlPath}`);
    }

    log.info(`Extracted Bible read data: [${JSON.stringify(result)}]`);
    return result;
}

/**
 * Extracts the section number from the given element's text.
 * @param {Cheerio} $element
 * @returns {number}
 * @throws {Error} If the element's text doesn't match the expected format.
 */
function getSectionNumberFromElement($element) {
    log.info("Extracting section number from element");
    const elementText = cleanText($element.text());
    if (!/^\d\./.test(elementText)) {
        const msg = `Unexpected section number for element [${elementText}].`;
        log.error(msg);
        throw new Error(msg);
    }
    const sectionNumber = parseInt(elementText.split('.')[0], 10);
    log.info(`Extracted section number: [${sectionNumber}]`);
    return sectionNumber;
}

/**
 * Finds and extracts the time box number from the given selection.
 * @param {Cheerio} $selection
 * @returns {number}
 * @throws {Error} If time box is not found.
 */
function getTimeBoxFromElement($selection) {
    log.info("Extracting time box from element");
    const msg = `No selection found for selector [${CONSTANTS.LINE_WITH_TIME_BOX_CSS_SELECTOR}]`;
    let $lineWithTimeBox = $selection.find(CONSTANTS.LINE_WITH_TIME_BOX_CSS_SELECTOR);
    if (!$lineWithTimeBox.length) {
        log.error(msg);
        throw new Error(msg);
    }

    const timeMatch = cleanText($lineWithTimeBox.text()).match(/\((\d+)\s*mins?\.\)/);
    if (timeMatch) {
        const timeBox = parseInt(timeMatch[1], 10);
        log.info(`Extracted time box: [${timeBox}] minutes`);
        return timeBox;
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
 * @typedef {Object} TreasuresTalkData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {string} heading - The heading for the section.
 * @property {TalkPoint[]} points - An array of points, each containing text and associated footnotes.
 * @property {Object<number, string>} footnotes - An object containing footnotes indexed by a numerically unique key.
 */

/**
 * Extracts the treasures talk data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<TreasuresTalkData>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractTreasuresTalk(input) {
    log.info("Extracting treasures talk data");

    input.selectionBuilder = ($) => buildGodsTreasuresSelections($).treasuresTalk;
    const {selection: $treasuresTalkSelection} = processExtractionInput(input);

    const result = {
        sectionNumber: getSectionNumberFromElement($treasuresTalkSelection.find(CONSTANTS.LINE_WITH_SECTION_NUMBER_CSS_SELECTOR)),
        timeBox: getTimeBoxFromElement($treasuresTalkSelection),
        heading: cleanText($treasuresTalkSelection.find(`h3`).text()),
        points: [],
        footnotes: {},
    };

    const $points = $treasuresTalkSelection.find(`> div > p`);
    log.debug(`Found [${$points.length}] points in the talk`);

    let footnoteKey = 0;
    for (let i = 0; i < $points.length; i++) {
        const $point = $points.eq(i);
        const talkPoint = {
            text: '',
            footnotes: [],
        };
        let pointText = cleanText($point.text());
        const $references = $point.find(`a`);

        log.debug(`Processing point [${i + 1}] with [${$references.length}] references`);

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
            log.debug(`Added footnote [${footnoteKey}] for reference: [${refText}]`);
        }

        talkPoint.text = pointText;
        result.points.push(talkPoint);
        log.debug(`Added talk point [${i + 1}]`);
    }

    log.info(`Extracted ten-minute talk data`);
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
 * Extracts the spiritual gems data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<SpiritualGemsData>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractSpiritualGems(input) {
    log.info("Extracting spiritual gems data");

    input.selectionBuilder = ($) => buildGodsTreasuresSelections($).spiritualGems;
    const {selection: $spiritualGemsSelection} = processExtractionInput(input);
    const $content = $spiritualGemsSelection.eq(1);

    const printedQuestionData = {
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

    log.debug(`Processing [${$answerSelection.length}] answer sources`);

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
        log.debug(`Added answer source [${i + 1}] for mnemonic [${printedQuestionData.answerSources[printedQuestionData.answerSources.length - 1].mnemonic}]`);
    }

    const result = {
        sectionNumber: getSectionNumberFromElement($spiritualGemsSelection.eq(0)),
        timeBox: getTimeBoxFromElement($content),
        printedQuestionData,
        openEndedQuestion: cleanText($content.find(`li.du-margin-top--8 p`).text()),
    };

    log.info(`Extracted spiritual gems data`);
    return result;
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
 * Extracts the bible reading data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<BibleReadData>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractBibleRead(input) {
    log.info("Extracting Bible reading data");

    input.selectionBuilder = ($) => buildGodsTreasuresSelections($).bibleRead;
    const {selection: $bibleReadSelection} = processExtractionInput(input);
    const $content = $bibleReadSelection.eq(1);
    const result = {
        sectionNumber: getSectionNumberFromElement($bibleReadSelection.eq(0)),
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

    log.info(`Extracted Bible reading data`);
    return result;
}

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
 * @typedef {Object} FieldMinistryAssignmentData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {boolean} isStudentTask - Indicates whether this is a student task.
 * @property {string} headline - The headline for the ministry task.
 * @property {string} contents - The content of the assignment task.
 * @property {StudyPoint | null} studyPoint - The study point associated with this task or null if none which means isStudentTask is false.
 */

/**
 * Extracts the field ministry data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {Promise<FieldMinistryAssignmentData[]>} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractFieldMinistry(input) {
    function extractBetweenParentheses(text) {
        const extractRegex = /\)\s*\s*(.*?)\s*(?=\s*\()/;
        const match = text.match(extractRegex);
        if (match) {
            return match[1];
        }
        return text;
    }

    log.info("Extracting field ministry data");
    input.selectionBuilder = ($) => buildFieldMinistrySelections($).fieldMinistry;
    const {$, selection: $fieldMinistrySelection} = processExtractionInput(input);
    const assignmentGroups = buildHeadlineToContentGroups($fieldMinistrySelection, $);

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

        log.debug(`Processing assignment: [${result.headline}], isStudentTask=[${result.isStudentTask}]`);

        if (!result.isStudentTask) {
            log.info(`Extracted field ministry assignment`);
            return result;
        }

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
        log.debug(`Added study point`);

        log.info(`Extracted field ministry assignment`);
        return result;
    });

    return Promise.all(promises);
}

/**
 * @typedef {Object} ChristianLivingSectionData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {string} contents - The content of the ministry task.
 */

/**
 * Extracts the Christian Living section data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {ChristianLivingSectionData[]} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export function extractChristianLiving(input) {
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

    log.info("Extracting Christian Living section data");
    input.selectionBuilder = ($) => buildChristianLivingSelections($).christianLiving
    const {$, selection: $christianLivingSelection} = processExtractionInput(input);
    const sectionGroups = buildHeadlineToContentGroups($christianLivingSelection, $);

    return sectionGroups.map(({heading, contents}) => {
        const result = {
            sectionNumber: getSectionNumberFromElement(heading),
            timeBox: getTimeBoxFromElement(contents[0]),
            contents: takeOutTimeBoxText(contents.map(polishElementText)),
        };
        log.info(`Extracted Christian Living section`);
        return result;
    });
}

/**
 * @typedef {Object} CongregationBibleStudyData
 * @property {number} sectionNumber - The meeting section number.
 * @property {number} timeBox - The time box for the section.
 * @property {string} contents - The content of the ministry task.
 * @property {string[]} references - The references to be covered during the study.
 */

/**
 * Extracts the Congregation Bible study data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {CongregationBibleStudyData} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export function extractBibleStudy(input) {
    log.info("Extracting Bible study section data");
    input.selectionBuilder = ($) => buildChristianLivingSelections($).bibleStudy;
    const {$, selection: $bibleStudySelection} = processExtractionInput(input);

    const result = {
        sectionNumber: getSectionNumberFromElement($bibleStudySelection.eq(0)),
        timeBox: getTimeBoxFromElement($bibleStudySelection),
        contents: cleanText($bibleStudySelection.text()),
        references: $bibleStudySelection.eq(1)
            .find('a')
            .map((i, el) => {
                const $el = $(el);
                return `${CONSTANTS.BASE_URL}${$el.attr('href')}`;
            })
            .get(),
    };

    log.info(`Extracted Bible study data`);
    return result;
}

/**
 * @typedef {Object} FullWeekProgramData
 * @property {string} weekDateSpan - The date span of the week.
 * @property {WeeklyBibleReadData} weeklyBibleReadData - The bible read data.
 * @property {TreasuresTalkData} treasuresTalk - The treasures talk data.
 * @property {SpiritualGemsData} spiritualGems - The spiritual gems' data.
 * @property {BibleReadData} bibleRead - The bible reading data.
 * @property {FieldMinistryAssignmentData[]} fieldMinistry - The field ministry data.
 * @property {ChristianLivingSectionData[]} christianLiving - The christian living data.
 * @property {CongregationBibleStudyData} bibleStudy - The congregation bible study data.
 */

/**
 * Extracts the full week program data from the given input.
 * @param {ExtractionInput} input The input object necessary values for correct extraction.
 * @returns {FullWeekProgramData} The extracted data.
 * @throws {Error} If the extraction fails.
 */
export async function extractFullWeekProgram(input) {

    log.info("Starting full week program extraction");
    const inputObj = processExtractionInput(input);
    const {$} = inputObj;
    const programGroups = buildRelevantProgramGroupSelections($);

    const weekDateSpan = extractWeekDateSpan(inputObj);
    const christianLiving = extractChristianLiving({$, selection: programGroups.christianLiving});
    const bibleStudy = extractBibleStudy({$, selection: programGroups.bibleStudy});

    const [
        [startingSong, middleSong, closingSong],
        weeklyBibleReadData,
        treasuresTalk,
        spiritualGems,
        bibleRead,
        fieldMinistry,
    ] = await Promise.all([
        extractSongData({$, selection: programGroups.songs}),
        extractWeeklyBibleRead({$, selection: programGroups.bibleRead}),
        extractTreasuresTalk({$, selection: programGroups.treasuresTalk}),
        extractSpiritualGems({$, selection: programGroups.spiritualGems}),
        extractBibleRead({$, selection: programGroups.bibleRead}),
        extractFieldMinistry({$, selection: programGroups.fieldMinistry}),
    ]);

    const result = {
        weekDateSpan,
        startingSong: startingSong,
        weeklyBibleReadData,
        treasuresTalk,
        spiritualGems,
        bibleRead,
        fieldMinistry,
        middleSong: middleSong,
        christianLiving,
        bibleStudy,
        closingSong: closingSong,
    };

    log.info("Successfully extracted full week program");
    return result;
}
