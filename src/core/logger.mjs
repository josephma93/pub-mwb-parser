import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const stderrStream = pino.destination(2);

// Configuración e inicialización del logger
const logger = pino(
    {
        level: LOG_LEVEL,
    },
    stderrStream
);

export default logger;