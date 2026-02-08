/**
 * Discord Embed Builders
 *
 * Factory functions for creating consistent, styled embeds
 * for music bot responses.
 *
 * Compatible with discord-player Track objects.
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
 * Parse a duration string like "3:45" or "1:02:30" into seconds
 */
function parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

/**
 * Create a visual progress bar
 */
function createProgressBar(current, total, length = 12) {
    if (!total || total === 0) return '[Live Stream]';

    const progress = Math.min(current / total, 1);
    const filled = Math.round(progress * length);
    const empty = length - filled;

    const filledChar = '\u2593';
    const emptyChar = '\u2591';

    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
}

/**
 * Create "Now Playing" embed for current track
 * Works with discord-player Track objects
 */
function nowPlayingEmbed(track, queue) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('Now Playing')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
            { name: 'Duration', value: track.duration || 'Unknown', inline: true },
            { name: 'Requested by', value: track.requestedBy?.toString() || 'Unknown', inline: true }
        );

    if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
    }

    // Show up next if there are more tracks in the queue
    if (queue && queue.tracks && queue.tracks.size > 0) {
        const nextTrack = queue.tracks.at(0);
        if (nextTrack) {
            const nextName = nextTrack.title.length > 50
                ? nextTrack.title.substring(0, 50) + '...'
                : nextTrack.title;
            embed.addFields({
                name: 'Up Next',
                value: nextName,
                inline: false
            });
        }
    }

    return embed;
}

/**
 * Create "Added to Queue" embed for enqueued track
 * Works with discord-player Track objects
 */
function addedToQueueEmbed(track, position) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('Added to Queue')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
            { name: 'Duration', value: track.duration || 'Unknown', inline: true },
            { name: 'Position', value: `#${position}`, inline: true },
            { name: 'Requested by', value: track.requestedBy?.toString() || 'Unknown', inline: true }
        );

    if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
    }

    return embed;
}

/**
 * Create queue display embed
 * Works with discord-player queue objects
 */
function queueEmbed(queue, page = 1, songsPerPage = 10) {
    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray();
    const allTracks = currentTrack ? [currentTrack, ...tracks] : tracks;
    const totalPages = Math.ceil(allTracks.length / songsPerPage) || 1;
    const startIndex = (page - 1) * songsPerPage;
    const endIndex = Math.min(startIndex + songsPerPage, allTracks.length);

    const queueList = allTracks
        .slice(startIndex, endIndex)
        .map((track, index) => {
            const position = startIndex + index;
            const prefix = position === 0 ? '**Now:**' : `**${position}.**`;
            const dur = track.duration || 'Unknown';
            const name = track.title.length > 40 ? track.title.substring(0, 40) + '...' : track.title;
            return `${prefix} [${name}](${track.url}) \`${dur}\``;
        })
        .join('\n');

    const totalDurationMs = allTracks.reduce((acc, t) => acc + (t.durationMS || 0), 0);

    const repeatModeMap = { 0: 'Off', 1: 'Track', 2: 'Queue', 3: 'Autoplay' };

    const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`Queue for ${queue.channel?.name || 'Voice Channel'}`)
        .setDescription(queueList || 'No songs in queue')
        .addFields(
            { name: 'Total Songs', value: `${allTracks.length}`, inline: true },
            { name: 'Total Duration', value: formatDuration(Math.floor(totalDurationMs / 1000)), inline: true },
            { name: 'Loop', value: repeatModeMap[queue.repeatMode] || 'Off', inline: true }
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
    parseDuration,
    createProgressBar,
    nowPlayingEmbed,
    addedToQueueEmbed,
    queueEmbed,
    errorEmbed,
    successEmbed,
    infoEmbed,
};
