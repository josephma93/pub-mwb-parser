import pino from 'pino';

const PMP_LOG_LEVEL = process.env.PMP_LOG_LEVEL || 'info';

const stderrStream = pino.destination(2);

const logger = pino(
    {
        level: PMP_LOG_LEVEL,
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