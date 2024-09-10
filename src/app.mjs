import logger from "./core/logger.mjs";
import {fetchThisWeekMeetingHtml} from "./services/html_retriever.mjs";
import {
    extractWeeklyBibleRead,
    extractBibleRead,
    extractBibleStudy,
    extractChristianLiving,
    extractFieldMinistry,
    extractFullWeekProgram,
    extractSpiritualGems,
    extractTreasuresTalk,
    extractWeekDateSpan, extractSongData
} from "./services/pub_mwb_scraper.mjs";

logger.info("Starting app");

let [err, html] = await fetchThisWeekMeetingHtml();
if (err) {
    logger.error(`Failed to fetch this week's meeting HTML: ${err.message}`);
} else {
    logger.info(`Successfully fetched this week's meeting HTML: ${html.length} characters`);

    let span = extractWeekDateSpan({html});
    console.log(`span: [${span}]`);

    let result = await extractWeeklyBibleRead({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);

    result = await extractSongData({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);

    result = await extractTreasuresTalk({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = await extractSpiritualGems({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = await extractBibleRead({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = await extractFieldMinistry({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = extractChristianLiving({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = extractBibleStudy({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);


    result = await extractFullWeekProgram({html});
    console.log(`errorOrResult: [${JSON.stringify(result, null, 2)}]`);
}

