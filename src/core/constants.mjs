const CONSTANTS = Object.freeze(Object.seal({
    BASE_URL: 'https://wol.jw.org',

    ARTICLE_CSS_SELECTOR: '#article',
    INTRODUCTION_CSS_SELECTOR: '#p3',
    TREASURES_TALK_CSS_SELECTOR: '#tt8',
    LINE_WITH_TIME_BOX_CSS_SELECTOR: '.du-color--textSubdued',

    MIDDLE_SONG_CSS_SELECTOR: '.bodyTxt > .dc-icon--music:not(:first-child)',
    FINAL_SONG_CSS_SELECTOR: '.bodyTxt > h3:last-child',

    PUB_CODE_WATCHTOWER: 'pub-w',
    PUB_CODE_BIBLE: 'pub-nwtsty',

    UNABLE_TO_FIND: 'UNABLE_TO_FIND',

    FIELD_MINISTRY_HEADLINE_CSS_SELECTOR: '.dc-icon--wheat',
    MIDWAY_SONG_HEADLINE_CSS_SELECTOR: '.dc-icon--music',
    CHRISTIAN_LIVING_HEADLINE_CSS_SELECTOR: '.dc-icon--sheep',
}));

export default CONSTANTS;