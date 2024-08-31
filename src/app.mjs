import logger from "./core/logger.mjs";
import {fetchThisWeekMeetingHtml, fetchThisWeekWatchtowerArticleHtml} from "./services/fetch_content.mjs";

logger.info("Starting app");

let [err, html] = await fetchThisWeekMeetingHtml();
if (err) {
    logger.error(`Failed to fetch this week's meeting HTML: ${err.message}`);
} else {
    logger.info(`Successfully fetched this week's meeting HTML: ${html.length} characters`);
}

[err, html] = await fetchThisWeekWatchtowerArticleHtml(html);
if (err) {
    logger.error(`Failed to fetch this week's watchtower article HTML: ${err.message}`);
} else {
    logger.info(`Successfully fetched and extracted this week's watchtower article HTML: ${html.length} characters`);
}

