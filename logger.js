// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${extra}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'] // Send errors to stderr → PM2 error log
    })
  ]
});

module.exports = logger;