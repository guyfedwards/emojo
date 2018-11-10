const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  exitOnError: false,
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.colorize({ all: true }),
    format.timestamp(),
    format.splat(),
    format.printf(
      info =>
        `${info.timestamp} ${info.level}: ${info.message} ${
          info.meta ? JSON.stringify(info.meta) : ''
        }`
    )
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
});

module.exports = logger;
