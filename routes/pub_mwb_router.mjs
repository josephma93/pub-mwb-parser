import express from 'express';
const router = express.Router();
import {fetchThisWeekMeetingHtml} from "../services/html_retriever.mjs";
import {extractFullWeekProgram} from "../services/pub_mwb_scraper.mjs";

router.get('/this-week-program', async (req, res, next) => {
  const [err, html] = await fetchThisWeekMeetingHtml();
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  try {
    const programData = extractFullWeekProgram({ html });
    res.json(programData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;