import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configuración e inicialización del logger
const logger = pino({
    level: LOG_LEVEL,
});

export default logger;