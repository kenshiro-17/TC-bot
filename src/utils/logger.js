/**
 * Simple Logger Utility
 *
 * Provides colored console output with timestamps and log levels.
 * Respects LOG_LEVEL environment variable for filtering.
 */

const { LOG_LEVELS } = require('../config/constants');

// ANSI color codes for terminal output
const COLORS = {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    GRAY: '\x1b[90m',
};

// Map log levels to colors
const LEVEL_COLORS = {
    DEBUG: COLORS.GRAY,
    INFO: COLORS.CYAN,
    WARN: COLORS.YELLOW,
    ERROR: COLORS.RED,
};

// Get configured log level from environment
function getConfiguredLevel() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toUpperCase();
    return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
}

// Format timestamp for log output
function getTimestamp() {
    return new Date().toISOString();
}

// Core logging function
function log(level, message, ...args) {
    const configuredLevel = getConfiguredLevel();
    const levelValue = LOG_LEVELS[level];

    // Skip if below configured level
    if (levelValue < configuredLevel) {
        return;
    }

    const color = LEVEL_COLORS[level] || COLORS.RESET;
    const timestamp = getTimestamp();
    const prefix = `${COLORS.GRAY}[${timestamp}]${COLORS.RESET} ${color}[${level}]${COLORS.RESET}`;

    if (args.length > 0) {
        console.log(prefix, message, ...args);
    } else {
        console.log(prefix, message);
    }
}

// Public API
const logger = {
    debug: (message, ...args) => log('DEBUG', message, ...args),
    info: (message, ...args) => log('INFO', message, ...args),
    warn: (message, ...args) => log('WARN', message, ...args),
    error: (message, ...args) => log('ERROR', message, ...args),

    // Convenience method for logging objects
    debugObject: (label, obj) => {
        log('DEBUG', `${label}:`, JSON.stringify(obj, null, 2));
    },
};

module.exports = logger;
