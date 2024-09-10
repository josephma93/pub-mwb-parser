import * as cheerio from 'cheerio';
import logger from "../../src/core/logger.mjs";
import CONSTANTS from "../../src/core/constants.mjs";
import {getAndValidateSongSelections} from "../../src/services/pub_mwb_program_selection_groups.mjs";

describe('DOM Validation Functions', () => {
    let $;
    let logSpy;

    beforeEach(() => {
        logSpy = spyOn(logger, 'error').and.callThrough();
        $ = cheerio.load(`
            <div>
                <h3 id="starting-song">Starting Song</h3>
                <h3 id="middle-song">Middle Song</h3>
                <h3 id="closing-song">Closing Song</h3>
                <h2 id="field-ministry-headline">Field Ministry</h2>
                <h2 id="christian-living-headline">Christian Living</h2>
                <h3 id="bible-study">Bible Study</h3>
                <h3 id="treasures-talk">Treasures Talk</h3>
                <div id="spiritual-gems">Spiritual Gems</div>
                <div id="bible-read">Bible Read</div>
            </div>
        `);
    });

    describe('getAndValidateSongSelections', () => {
        it('should return valid song selections when DOM structure is correct', () => {
            spyOn(CONSTANTS, 'STARTING_SONG_CSS_SELECTOR').and.returnValue('#starting-song');
            spyOn(CONSTANTS, 'MIDDLE_SONG_CSS_SELECTOR').and.returnValue('#middle-song');
            spyOn(CONSTANTS, 'FINAL_SONG_CSS_SELECTOR').and.returnValue('#closing-song');

            const { songs, startingSong, middleSong, closingSong } = getAndValidateSongSelections($);

            expect(startingSong.attr('id')).toBe('starting-song');
            expect(middleSong.attr('id')).toBe('middle-song');
            expect(closingSong.attr('id')).toBe('closing-song');
            expect(songs.length).toBe(3);
        });

        it('should throw an error if a song is not an h3', () => {
            spyOn(CONSTANTS, 'STARTING_SONG_CSS_SELECTOR').and.returnValue('div');
            expect(() => getAndValidateSongSelections($)).toThrowError(/Unexpected element detected/);
            expect(logSpy).toHaveBeenCalledWith(jasmine.stringMatching(/Unexpected element detected/));
        });
    });

    describe('buildGodsTreasuresSelections', () => {
        it('should return valid treasures selections when DOM structure is correct', () => {
            spyOn(CONSTANTS, 'TREASURES_TALK_CSS_SELECTOR').and.returnValue('#treasures-talk');
            spyOn(CONSTANTS, 'FIELD_MINISTRY_HEADLINE_CSS_SELECTOR').and.returnValue('#field-ministry-headline');

            const selections = buildGodsTreasuresSelections($);

            expect(selections.treasuresTalk.attr('id')).toBe('treasures-talk');
            expect(selections.spiritualGems.length).toBe(2);
            expect(selections.bibleRead.length).toBe(2);
        });

        it('should throw an error if the number of elements for points 2 and 3 is incorrect', () => {
            spyOn(CONSTANTS, 'TREASURES_TALK_CSS_SELECTOR').and.returnValue('#starting-song');  // Wrong selector
            spyOn(CONSTANTS, 'FIELD_MINISTRY_HEADLINE_CSS_SELECTOR').and.returnValue('#field-ministry-headline');

            expect(() => buildGodsTreasuresSelections($)).toThrowError(/Unexpected number of elements for points 2 and 3/);
            expect(logSpy).toHaveBeenCalledWith(jasmine.stringMatching(/Unexpected number of elements for points 2 and 3/));
        });
    });

    describe('buildChristianLivingSelections', () => {
        it('should return valid Christian Living selections when DOM structure is valid', () => {
            spyOn(CONSTANTS, 'MIDDLE_SONG_CSS_SELECTOR').and.returnValue('#middle-song');
            spyOn(CONSTANTS, 'FINAL_SONG_CSS_SELECTOR').and.returnValue('#closing-song');

            const selections = buildChristianLivingSelections($);

            expect(selections.christianLiving.length).toBeGreaterThan(0);  // Expecting some elements
            expect(selections.bibleStudy.attr('id')).toBe('bible-study');
        });

        it('should throw an error if the Bible Study headline is not an h3', () => {
            spyOn(CONSTANTS, 'MIDDLE_SONG_CSS_SELECTOR').and.returnValue('#middle-song');
            spyOn(CONSTANTS, 'FINAL_SONG_CSS_SELECTOR').and.returnValue('div');  // Wrong structure

            expect(() => buildChristianLivingSelections($)).toThrowError(/Unexpected element detected/);
            expect(logSpy).toHaveBeenCalledWith(jasmine.stringMatching(/Unexpected element detected/));
        });
    });

    describe('buildFieldMinistrySelections', () => {
        it('should return field ministry selections when DOM structure is valid', () => {
            spyOn(CONSTANTS, 'FIELD_MINISTRY_HEADLINE_CSS_SELECTOR').and.returnValue('#field-ministry-headline');
            spyOn(CONSTANTS, 'CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR').and.returnValue('#christian-living-headline');

            const selections = buildFieldMinistrySelections($);

            expect(selections.fieldMinistry.length).toBeGreaterThan(0);  // Should find elements between headlines
        });

        it('should return an empty selection if no elements are between headlines', () => {
            spyOn(CONSTANTS, 'FIELD_MINISTRY_HEADLINE_CSS_SELECTOR').and.returnValue('#closing-song');  // Invalid headline
            spyOn(CONSTANTS, 'CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR').and.returnValue('#christian-living-headline');

            const selections = buildFieldMinistrySelections($);

            expect(selections.fieldMinistry.length).toBe(0);  // No elements between closing-song and Christian Living
        });
    });

    describe('buildRelevantProgramGroupSelections', () => {
        it('should return all relevant selections when DOM structure is valid', () => {
            spyOn(CONSTANTS, 'STARTING_SONG_CSS_SELECTOR').and.returnValue('#starting-song');
            spyOn(CONSTANTS, 'MIDDLE_SONG_CSS_SELECTOR').and.returnValue('#middle-song');
            spyOn(CONSTANTS, 'FINAL_SONG_CSS_SELECTOR').and.returnValue('#closing-song');
            spyOn(CONSTANTS, 'FIELD_MINISTRY_HEADLINE_CSS_SELECTOR').and.returnValue('#field-ministry-headline');
            spyOn(CONSTANTS, 'CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR').and.returnValue('#christian-living-headline');
            spyOn(CONSTANTS, 'TREASURES_TALK_CSS_SELECTOR').and.returnValue('#treasures-talk');
            spyOn(CONSTANTS, 'INTRODUCTION_CSS_SELECTOR').and.returnValue('#introduction');

            const selections = buildRelevantProgramGroupSelections($);

            expect(selections.startingSong.attr('id')).toBe('starting-song');
            expect(selections.closingSong.attr('id')).toBe('closing-song');
            expect(selections.fieldMinistry.length).toBeGreaterThan(0);
            expect(selections.christianLiving.length).toBeGreaterThan(0);
        });

        it('should throw an error if the DOM structure is invalid for any part', () => {
            spyOn(CONSTANTS, 'STARTING_SONG_CSS_SELECTOR').and.returnValue('div');  // Simulate wrong selector

            expect(() => buildRelevantProgramGroupSelections($)).toThrowError(/Unexpected element detected/);
            expect(logSpy).toHaveBeenCalledWith(jasmine.stringMatching(/Unexpected element detected/));
        });
    });
});