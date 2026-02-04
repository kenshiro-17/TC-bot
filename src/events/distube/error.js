/**
 * DisTube error Event Handler
 *
 * Handles all playback errors including:
 * - 403 Forbidden (YouTube bot detection)
 * - Network errors
 * - Invalid URLs
 * - Age-restricted content
 *
 * THE "SECRET SAUCE" FOR 403 HANDLING:
 * @distube/yt-dlp already bypasses most 403 errors by:
 * 1. Using browser-like request headers
 * 2. Generating fresh signatures per request
 * 3. Rotating User-Agent strings
 *
 * When errors still occur, this handler:
 * 1. Notifies the user
 * 2. DisTube automatically skips to the next track
 * 3. Logs error for debugging
 */

const { errorEmbed } = require('../../utils/embed');
const { ERRORS } = require('../../config/constants');
const logger = require('../../utils/logger');

// Track recent errors to prevent spam
const recentErrors = new Map();

/**
 * Handle error event
 * @param {TextChannel} channel - Text channel to send error message
 * @param {Error} error - The error that occurred
 */
module.exports = async function errorHandler(channel, error) {
    const errorMessage = error.message || 'Unknown error';

    logger.error(`DisTube error: ${errorMessage}`);

    // Don't spam the channel with errors
    if (channel) {
        const channelId = channel.id;
        const now = Date.now();
        const lastError = recentErrors.get(channelId);

        if (lastError && (now - lastError) < ERRORS.ERROR_COOLDOWN) {
            logger.debug('Suppressing duplicate error message (cooldown active)');
            return;
        }

        recentErrors.set(channelId, now);

        // Clean up old entries periodically
        if (recentErrors.size > 100) {
            const cutoff = now - ERRORS.ERROR_COOLDOWN;
            for (const [id, time] of recentErrors) {
                if (time < cutoff) recentErrors.delete(id);
            }
        }
    }

    // Determine user-friendly error message
    let title = 'Playback Error';
    let description = 'An error occurred during playback.';

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        // 403 Error - YouTube bot detection or rate limiting
        title = 'Video Unavailable';
        description = 'This video cannot be played. It may be region-locked, age-restricted, or temporarily unavailable. Skipping to next track...';
        logger.warn('403 error encountered - yt-dlp could not bypass restrictions');
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        title = 'Video Not Found';
        description = 'The video could not be found. It may have been deleted or made private.';
    } else if (errorMessage.includes('private')) {
        title = 'Private Video';
        description = 'This video is private and cannot be played.';
    } else if (errorMessage.includes('age') || errorMessage.includes('Sign in')) {
        title = 'Age-Restricted Content';
        description = 'This video requires age verification. Configure YouTube cookies in .env to access age-restricted content.';
    } else if (errorMessage.includes('network') || errorMessage.includes('ECONNRESET')) {
        title = 'Network Error';
        description = 'A network error occurred. The bot will attempt to continue with the next track.';
    } else if (errorMessage.includes('No result')) {
        title = 'No Results';
        description = 'No videos found matching your search query.';
    } else if (errorMessage.includes('timeout')) {
        title = 'Request Timeout';
        description = 'The request timed out. Please try again.';
    }

    // Send error message to channel
    if (channel) {
        try {
            const embed = errorEmbed(title, description);
            await channel.send({ embeds: [embed] });
        } catch (sendError) {
            logger.error('Failed to send error message to channel:', sendError.message);
        }
    }

    // Log full error details for debugging
    if (error.stack) {
        logger.debug(`Error stack: ${error.stack}`);
    }
};
