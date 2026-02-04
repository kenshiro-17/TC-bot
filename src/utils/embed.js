/**
 * Discord Embed Builders
 *
 * Factory functions for creating consistent, styled embeds
 * for music bot responses.
 */

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

/**
 * Format duration in seconds to MM:SS or HH:MM:SS string
 */
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return 'Live';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create "Now Playing" embed for current track
 */
function nowPlayingEmbed(song, queue) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('Now Playing')
        .setDescription(`[${song.name}](${song.url})`)
        .addFields(
            { name: 'Duration', value: formatDuration(song.duration), inline: true },
            { name: 'Requested by', value: song.user?.toString() || 'Unknown', inline: true }
        );

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    if (queue && queue.songs.length > 1) {
        embed.addFields({
            name: 'Up Next',
            value: queue.songs[1].name.substring(0, 50) + (queue.songs[1].name.length > 50 ? '...' : ''),
            inline: false
        });
    }

    return embed;
}

/**
 * Create "Added to Queue" embed for enqueued track
 */
function addedToQueueEmbed(song, position) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('Added to Queue')
        .setDescription(`[${song.name}](${song.url})`)
        .addFields(
            { name: 'Duration', value: formatDuration(song.duration), inline: true },
            { name: 'Position', value: `#${position}`, inline: true },
            { name: 'Requested by', value: song.user?.toString() || 'Unknown', inline: true }
        );

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    return embed;
}

/**
 * Create queue display embed
 */
function queueEmbed(queue, page = 1, songsPerPage = 10) {
    const songs = queue.songs;
    const totalPages = Math.ceil(songs.length / songsPerPage);
    const startIndex = (page - 1) * songsPerPage;
    const endIndex = Math.min(startIndex + songsPerPage, songs.length);

    const currentSong = songs[0];
    const queueList = songs
        .slice(startIndex, endIndex)
        .map((song, index) => {
            const position = startIndex + index;
            const prefix = position === 0 ? '**Now:**' : `**${position}.**`;
            const duration = formatDuration(song.duration);
            const name = song.name.length > 40 ? song.name.substring(0, 40) + '...' : song.name;
            return `${prefix} [${name}](${song.url}) \`${duration}\``;
        })
        .join('\n');

    const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);

    const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`Queue for ${queue.voiceChannel?.name || 'Voice Channel'}`)
        .setDescription(queueList || 'No songs in queue')
        .addFields(
            { name: 'Total Songs', value: `${songs.length}`, inline: true },
            { name: 'Total Duration', value: formatDuration(totalDuration), inline: true },
            { name: 'Loop', value: queue.repeatMode === 0 ? 'Off' : queue.repeatMode === 1 ? 'Song' : 'Queue', inline: true }
        )
        .setFooter({ text: `Page ${page}/${totalPages}` });

    return embed;
}

/**
 * Create error embed
 */
function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle(title)
        .setDescription(description);
}

/**
 * Create success embed
 */
function successEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(title)
        .setDescription(description);
}

/**
 * Create info embed
 */
function infoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(title)
        .setDescription(description);
}

module.exports = {
    formatDuration,
    nowPlayingEmbed,
    addedToQueueEmbed,
    queueEmbed,
    errorEmbed,
    successEmbed,
    infoEmbed,
};
