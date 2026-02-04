/**
 * Bot Configuration Constants
 *
 * Centralized configuration for audio pipeline, timing, and bot behavior.
 * Adjust these values to tune performance and user experience.
 */

module.exports = {
    // Channel Configuration
    CHANNELS: {
        // Name of the dedicated music requests channel
        MUSIC_REQUESTS_NAME: 'music-requests',
    },

    // Audio Configuration
    AUDIO: {
        // Stream type for DisTube
        // 0 = Opus (recommended - native Discord format, no transcoding needed)
        // 1 = Raw (requires FFmpeg transcoding)
        STREAM_TYPE: 0,

        // Silence padding frames appended after audio ends
        // Each frame = 20ms, so 5 frames = 100ms jitter buffer
        // Higher values = smoother playback but slight delay at track end
        // Lower values = faster transitions but may clip audio
        SILENCE_PADDING_FRAMES: 5,

        // Default volume (0-100)
        DEFAULT_VOLUME: 80,

        // Leave voice channel after being idle for this duration (ms)
        // Set to 0 to disable auto-leave
        IDLE_TIMEOUT: 300000, // 5 minutes
    },

    // Queue Configuration
    QUEUE: {
        // Maximum songs allowed in queue per guild
        MAX_SIZE: 500,

        // Maximum songs to display in /queue command
        DISPLAY_LIMIT: 10,

        // Enable track history for "previous" functionality
        ENABLE_HISTORY: true,
        MAX_HISTORY: 50,
    },

    // Embed Colors (hex values)
    COLORS: {
        PRIMARY: 0x5865F2,    // Discord Blurple
        SUCCESS: 0x57F287,    // Green
        WARNING: 0xFEE75C,    // Yellow
        ERROR: 0xED4245,      // Red
        INFO: 0x5865F2,       // Blurple
    },

    // Error Handling
    ERRORS: {
        // Maximum retries for stream fetch failures
        MAX_RETRIES: 3,

        // Base delay for exponential backoff (ms)
        RETRY_BASE_DELAY: 1000,

        // Cooldown between error messages to prevent spam (ms)
        ERROR_COOLDOWN: 5000,
    },

    // Reconnection Strategy
    RECONNECTION: {
        // Maximum reconnection attempts before giving up
        MAX_ATTEMPTS: 5,

        // Base delay for exponential backoff (ms)
        BASE_DELAY: 1000,

        // Maximum delay cap (ms)
        MAX_DELAY: 30000,

        // Exponential multiplier
        MULTIPLIER: 2,
    },

    // Logging
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    },
};
