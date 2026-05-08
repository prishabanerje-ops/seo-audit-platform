/**
 * Logger utility
 * Simple prefixed console logger for crawl progress.
 * Swap this for a proper logger (pino, winston) later if needed.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, prefix, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const line = `[${timestamp()}] [${level.toUpperCase()}] [${prefix}]`;
  if (level === 'error') {
    console.error(line, ...args);
  } else if (level === 'warn') {
    console.warn(line, ...args);
  } else {
    console.log(line, ...args);
  }
}

/**
 * Create a namespaced logger.
 * @param {string} prefix — e.g. 'crawler', 'extractor:meta'
 */
export function createLogger(prefix) {
  return {
    debug: (...args) => log('debug', prefix, ...args),
    info:  (...args) => log('info',  prefix, ...args),
    warn:  (...args) => log('warn',  prefix, ...args),
    error: (...args) => log('error', prefix, ...args),
  };
}

export default createLogger;
