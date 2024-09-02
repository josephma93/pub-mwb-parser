import logger from "./core/logger.mjs";
import {fetchThisWeekMeetingHtml} from "./services/html_retriever.mjs";
import {extractFullWeekProgram} from "./services/pub_mwb_scraper.mjs";

logger.info("Starting app");

let [err, html] = await fetchThisWeekMeetingHtml();
if (err) {
    logger.error(`Failed to fetch this week's meeting HTML: ${err.message}`);
} else {
    logger.info(`Successfully fetched this week's meeting HTML: ${html.length} characters`);
    const [err, program] = await extractFullWeekProgram(html);
    if (err) {
        logger.error(`Failed to extract this week's program: ${err.message}`);
    } else {
        console.log(`This week's program: [${JSON.stringify(program, null, 2)}]`);
    }
}

