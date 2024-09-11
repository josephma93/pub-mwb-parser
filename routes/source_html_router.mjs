import express from 'express';
import {fetchLandingHtml, fetchThisWeekMeetingHtml} from "../services/html_retriever.mjs";

const router = express.Router();

/**
 * GET /source-html/meeting-html
 * Fetches the HTML for this week's meeting.
 */
router.get('/meeting-html', async (req, res) => {
    try {
        const [err, html] = await fetchThisWeekMeetingHtml();
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ html });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /source-html/landing-html
 * Fetches the landing page HTML from the WOL website.
 */
router.get('/landing-html', async (req, res) => {
    try {
        const [err, html] = await fetchLandingHtml();
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ html });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;