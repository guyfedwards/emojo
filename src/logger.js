const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  exitOnError: false,
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.timestamp(),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
});

module.exports = logger;
