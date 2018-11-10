const logger = require('./src/logger');

logger.transports.forEach(t => (t.silent = true));
