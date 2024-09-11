import logger from "../../core/logger.mjs";
import CONSTANTS from "../../core/constants.mjs";

const log = logger.child(logger.bindings());

/**
 * Validate that the given selection is a h3 element.
 * @param {Cheerio} selection - The selection to check.
 * @throws {Error} If the selection is not a h3 element.
 */
function assertIsH3(selection) {
    if (!selection.is('h3')) {
        const msg = `Unexpected element detected. Expected h3, got ${selection[0].name}`;
        log.error(msg);
        throw new Error(msg);
    }
}

/**
 * Validate the number of headline elements for Field Ministry and Christian Living.
 * @param {Cheerio} fieldMinistryHeadline - The selection for Field Ministry.
 * @param {Cheerio} christianLivingHeadline - The selection for Christian Living.
 * @throws {Error} If the number of headline elements is not as expected.
 */
function assertHeadlineDOMStructure(fieldMinistryHeadline, christianLivingHeadline) {
    if (fieldMinistryHeadline.find('> h2').length !== 1 || christianLivingHeadline.find('> h2').length !== 1) {
        const msg = 'Unexpected number of elements for field ministry and christian living.';
        log.error(msg);
        throw new Error(msg);
    }
}

/**
 * Retrieve and validate the songs (middle and final).
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @returns {{ songs: Cheerio, startingSong: Cheerio, middleSong: Cheerio, closingSong: Cheerio }} The selections.
 * @throws {Error} If the DOM structure is not as expected.
 */
export function getAndValidateSongSelections($) {
    const startingSong = $(CONSTANTS.STARTING_SONG_CSS_SELECTOR);
    const middleSong = $(CONSTANTS.MIDDLE_SONG_CSS_SELECTOR);
    const closingSong = $(CONSTANTS.FINAL_SONG_CSS_SELECTOR);
    assertIsH3(startingSong);
    assertIsH3(middleSong);
    assertIsH3(closingSong);
    const songs = $([startingSong, middleSong, closingSong]);
    return { songs, startingSong, middleSong, closingSong };
}

/**
 * @typedef {Object} GodsTreasuresSelections
 * @property {Cheerio} treasuresTalk - The selection for Treasures Talk.
 * @property {Cheerio} spiritualGems - The selection for Spiritual Gems.
 * @property {Cheerio} bibleRead - The selection for Bible Read.
 */

/**
 * Retrieve and validate the Treasures Talk and subsequent elements.
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @param {Cheerio} fieldMinistryHeadline - The field ministry headline element.
 * @returns {GodsTreasuresSelections} The treasures talk and related elements.
 * @throws {Error} If the DOM structure is not as expected.
 */
function getAndValidateGodsTreasuresSelections($, fieldMinistryHeadline) {
    const treasuresTalk = $(CONSTANTS.TREASURES_TALK_CSS_SELECTOR);
    const points2and3 = treasuresTalk.nextUntil(fieldMinistryHeadline);
    if (points2and3.length !== 4) {
        const msg = `Unexpected number of elements for points 2 and 3. Expected 4, got ${points2and3.length}`;
        log.error(msg);
        throw new Error(msg);
    }
    const spiritualGems = points2and3.slice(0, 2);
    const bibleRead = points2and3.slice(2, 4);
    return { treasuresTalk, spiritualGems, bibleRead };
}

/**
 * Allows easier creation of gods treasures selections.
 * @param {ReturnType<CheerioAPI>} $
 * @returns {GodsTreasuresSelections}
 */
export function buildGodsTreasuresSelections($) {
    const {fieldMinistryHeadline} = buildAndValidateHeadlineSelections($);
    return getAndValidateGodsTreasuresSelections($, fieldMinistryHeadline);
}

/**
 * @typedef {Object} ChristianLivingSelections
 * @property {Cheerio} christianLiving - The selection for Christian Living.
 * @property {Cheerio} bibleStudy - The selection for Bible Study.
 */

/**
 * Retrieve and validate the Christian Living section.
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @param {Cheerio} middleSong - The middle song element.
 * @param {Cheerio} closingSong - The final song element.
 * @returns {ChristianLivingSelections} The Christian Living section and the Bible study headline.
 * @throws {Error} If the DOM structure is not as expected.
 */
function getAndValidateChristianLivingSelections($, middleSong, closingSong) {
    const bibleStudyHeadline = closingSong.prevAll('h3').first();
    assertIsH3(bibleStudyHeadline);
    let christianLiving = middleSong.nextUntil(bibleStudyHeadline);
    const bibleStudySiblings = closingSong.prevUntil(bibleStudyHeadline);
    const bibleStudy = bibleStudySiblings.add(bibleStudyHeadline);
    return { christianLiving, bibleStudy };
}

/**
 * Allows easier creation of christian living selections.
 * @param {ReturnType<CheerioAPI>} $
 * @returns {ChristianLivingSelections}
 */
export function buildChristianLivingSelections($) {
    const { middleSong, closingSong } = getAndValidateSongSelections($);
    return getAndValidateChristianLivingSelections($, middleSong, closingSong);
}

/**
 * @typedef {Object} FieldMinistrySelection
 * @property {Cheerio} fieldMinistry - The selection for Field Ministry.
 */

/**
 * Build the field ministry group selection.
 * @param {Cheerio} fieldMinistryHeadline - The field ministry headline element.
 * @param {Cheerio} christianLivingHeadline - The christian living headline element.
 * @returns {FieldMinistrySelection}
 */
function getAndValidateFieldMinistrySelection(fieldMinistryHeadline, christianLivingHeadline) {
    return {
        fieldMinistry: fieldMinistryHeadline.nextUntil(christianLivingHeadline),
    };
}

/**
 * Allows easier creation of field ministry selections.
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @returns {FieldMinistrySelection}
 */
export function buildFieldMinistrySelections($) {
    const {fieldMinistryHeadline, christianLivingHeadline} = buildAndValidateHeadlineSelections($);
    return getAndValidateFieldMinistrySelection(fieldMinistryHeadline, christianLivingHeadline);
}

/**
 * Build and validate the headlines.
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @returns {{fieldMinistryHeadline: Cheerio, christianLivingHeadline: Cheerio}}
 * @throws {Error} If the DOM structure is not as expected.
 */
function buildAndValidateHeadlineSelections($) {
    const fieldMinistryHeadline = $(CONSTANTS.FIELD_MINISTRY_HEADLINE_CSS_SELECTOR);
    const christianLivingHeadline = $(CONSTANTS.CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR);
    assertHeadlineDOMStructure(fieldMinistryHeadline, christianLivingHeadline);
    return {fieldMinistryHeadline, christianLivingHeadline};
}

/**
 * @typedef {Object} RelevantProgramGroupSelections
 * @property {Cheerio} introduction - The introduction selection.
 * @property {Cheerio} [songs] - A cheerio selection including all the songs.
 * @property {Cheerio} [startingSong] - The starting song selection.
 * @property {Cheerio} [treasuresTalk] - The treasures talk selection.
 * @property {Cheerio} [spiritualGems] - The spiritual gems' selection.
 * @property {Cheerio} [bibleRead] - The bible read selection.
 * @property {Cheerio} [fieldMinistry] - The field ministry selection.
 * @property {Cheerio} [middleSong] - The middle song selection.
 * @property {Cheerio} [christianLiving] - The christian living selection.
 * @property {Cheerio} [bibleStudy] - The bible study selection.
 * @property {Cheerio} [closingSong] - The final song selection.
 */

/**
 * Build the final program group selections object.
 * @param {ReturnType<CheerioAPI>} $ - The cheerio instance.
 * @returns {RelevantProgramGroupSelections} Object containing all the relevant program group selections.
 * @throws {Error} If the DOM structure is not as expected.
 */
export function buildRelevantProgramGroupSelections($) {
    const { fieldMinistryHeadline, christianLivingHeadline } = buildAndValidateHeadlineSelections($);
    const { songs, startingSong, middleSong, closingSong } = getAndValidateSongSelections($);
    const { treasuresTalk, spiritualGems, bibleRead } = getAndValidateGodsTreasuresSelections($, fieldMinistryHeadline);
    const { fieldMinistry } = getAndValidateFieldMinistrySelection(fieldMinistryHeadline, christianLivingHeadline);
    const { christianLiving, bibleStudy } = getAndValidateChristianLivingSelections($, middleSong, closingSong);

    return {
        introduction: $(CONSTANTS.INTRODUCTION_CSS_SELECTOR),
        songs,
        startingSong,
        treasuresTalk,
        spiritualGems,
        bibleRead,
        fieldMinistry,
        middleSong,
        christianLiving,
        bibleStudy,
        closingSong,
    };
}