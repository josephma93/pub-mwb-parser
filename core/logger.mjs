import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const stderrStream = pino.destination(2);

const logger = pino(
    {
        level: LOG_LEVEL,
        formatters: {
            level(label) {
                return {level: label};
            }
        },
        base: null,
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    stderrStream
);

export default logger;