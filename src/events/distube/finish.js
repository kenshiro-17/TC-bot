/**
 * DisTube finish Event Handler
 *
 * Fires when the queue finishes playing all songs.
 * The bot may stay in the voice channel or leave based on configuration.
 */

const { infoEmbed } = require('../../utils/embed');
const { AUDIO } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Handle finish event
 * @param {Queue} queue - DisTube queue instance
 */
module.exports = async function finishHandler(queue) {
    const channel = queue.textChannel;

    logger.info(`Queue finished in guild: ${queue.id}`);

    if (channel) {
        try {
            let description = 'The queue has finished playing.';

            if (AUDIO.IDLE_TIMEOUT > 0) {
                const minutes = Math.floor(AUDIO.IDLE_TIMEOUT / 60000);
                description += ` I'll leave the channel in ${minutes} minute${minutes !== 1 ? 's' : ''} if no new songs are added.`;
            }

            const embed = infoEmbed('Queue Finished', description);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Failed to send finish message:', error.message);
        }
    }
};
