/**
 * DisTube disconnect Event Handler
 *
 * Fires when the bot disconnects from a voice channel.
 * This can happen due to:
 * - Being kicked from the channel
 * - Channel being deleted
 * - Manual disconnect via /stop
 * - Network issues (after reconnection attempts fail)
 */

const { infoEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

/**
 * Handle disconnect event
 * @param {Queue} queue - DisTube queue instance
 */
module.exports = async function disconnectHandler(queue) {
    const channel = queue.textChannel;
    const voiceChannelName = queue.voiceChannel?.name || 'the voice channel';

    logger.info(`Disconnected from voice channel in guild: ${queue.id}`);

    if (channel) {
        try {
            const embed = infoEmbed(
                'Disconnected',
                `Left ${voiceChannelName}. The queue has been cleared.`
            );
            await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Failed to send disconnect message:', error.message);
        }
    }
};
