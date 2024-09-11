import express from 'express';
import checkHtmlContent from "../middlewares/check_html_content.mjs";
import {
    extractBibleRead,
    extractBibleStudy,
    extractChristianLiving,
    extractFieldMinistry,
    extractFullWeekProgram,
    extractSongData,
    extractSpiritualGems,
    extractTreasuresTalk,
    extractWeekDateSpan,
    extractWeeklyBibleRead,
} from "../services/pub_mwb_scraper.mjs";

const router = express.Router();

/**
 * POST /week-program
 * Extracts the full week program from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/week-program', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const programData = await extractFullWeekProgram({ html });
        res.json(programData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /week-date-span
 * Extracts the week date span from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/week-date-span', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const weekDateSpan = extractWeekDateSpan({ html });
        res.json({ weekDateSpan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /songs
 * Extracts song data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/songs', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const songData = await extractSongData({ html });
        res.json(songData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /bible-read
 * Extracts Bible reading data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/weekly-bible-read', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const bibleReadData = await extractWeeklyBibleRead({ html });
        res.json(bibleReadData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /treasures-talk
 * Extracts the treasures talk data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/treasures-talk', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const treasuresTalk = await extractTreasuresTalk({ html });
        res.json(treasuresTalk);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /spiritual-gems
 * Extracts the spiritual gems data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/spiritual-gems', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const spiritualGems = await extractSpiritualGems({ html });
        res.json(spiritualGems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /bible-read-details
 * Extracts detailed Bible reading data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/bible-read-details', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const bibleReadData = await extractBibleRead({ html });
        res.json(bibleReadData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /field-ministry
 * Extracts field ministry data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/field-ministry', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const fieldMinistryData = await extractFieldMinistry({ html });
        res.json(fieldMinistryData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /christian-living
 * Extracts the Christian living section data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/christian-living', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const christianLivingData = extractChristianLiving({ html });
        res.json(christianLivingData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /bible-study
 * Extracts the Bible study section data from the HTML.
 * Expects raw HTML in the request body.
 */
router.post('/bible-study', checkHtmlContent, async (req, res) => {
    try {
        const { html } = req.body;
        const bibleStudyData = extractBibleStudy({ html });
        res.json(bibleStudyData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;