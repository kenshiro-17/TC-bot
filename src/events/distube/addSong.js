/**
 * DisTube addSong Event Handler
 *
 * Fires when a song is added to an existing queue.
 * (Does NOT fire for the first song - that triggers playSong instead)
 */

const { addedToQueueEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

/**
 * Handle addSong event
 * @param {Queue} queue - DisTube queue instance
 * @param {Song} song - The song that was added
 */
module.exports = async function addSongHandler(queue, song) {
    const channel = queue.textChannel;

    if (!channel) {
        logger.warn('No text channel available for addSong notification');
        return;
    }

    try {
        // Position in queue (excluding currently playing song)
        const position = queue.songs.length;
        const embed = addedToQueueEmbed(song, position);

        await channel.send({ embeds: [embed] });

        logger.info(`Added to queue: ${song.name} (position #${position})`);
    } catch (error) {
        logger.error('Failed to send added to queue message:', error.message);
    }
};
