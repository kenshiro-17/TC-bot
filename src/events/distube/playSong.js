/**
 * DisTube playSong Event Handler
 *
 * Fires when a new song starts playing.
 * Sends "Now Playing" embed to the text channel.
 */

const { nowPlayingEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

/**
 * Handle playSong event
 * @param {Queue} queue - DisTube queue instance
 * @param {Song} song - The song that started playing
 */
module.exports = async function playSongHandler(queue, song) {
    const channel = queue.textChannel;

    if (!channel) {
        logger.warn('No text channel available for playSong notification');
        return;
    }

    try {
        const embed = nowPlayingEmbed(song, queue);
        await channel.send({ embeds: [embed] });

        logger.info(`Now playing: ${song.name} in ${queue.voiceChannel?.name || 'unknown channel'}`);
    } catch (error) {
        logger.error('Failed to send now playing message:', error.message);
    }
};
