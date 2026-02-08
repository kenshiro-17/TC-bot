/**
 * /nowplaying Slash Command
 *
 * Displays information about the currently playing song with a progress bar.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, formatDuration, createProgressBar } = require('../utils/embed');
const { COLORS } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song'),

    async execute(interaction) {
        const queue = useQueue(interaction.guildId);

        // Check if there's an active queue with a playing song
        if (!queue || !queue.currentTrack) {
            return interaction.reply({
                embeds: [errorEmbed('Nothing Playing', 'There is no song currently playing. Use `/play` to start!')],
                ephemeral: true
            });
        }

        try {
            const track = queue.currentTrack;
            const progress = queue.node.getTimestamp();
            const currentMs = progress?.current?.value || 0;
            const totalMs = progress?.total?.value || track.durationMS || 0;
            const currentSec = Math.floor(currentMs / 1000);
            const totalSec = Math.floor(totalMs / 1000);

            // Create progress bar
            const progressBar = createProgressBar(currentSec, totalSec);
            const timeDisplay = `${formatDuration(currentSec)} / ${track.duration || formatDuration(totalSec)}`;

            // Build the embed
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('Now Playing')
                .setDescription(`[${track.title}](${track.url})`)
                .addFields(
                    {
                        name: 'Progress',
                        value: `${progressBar}\n\`${timeDisplay}\``,
                        inline: false
                    },
                    {
                        name: 'Requested by',
                        value: track.requestedBy?.toString() || 'Unknown',
                        inline: true
                    },
                    {
                        name: 'Volume',
                        value: `${queue.node.volume}%`,
                        inline: true
                    }
                );

            // Add thumbnail if available
            if (track.thumbnail) {
                embed.setThumbnail(track.thumbnail);
            }

            // Show up next if there are more songs
            if (queue.tracks.size > 0) {
                const nextTrack = queue.tracks.at(0);
                const nextName = nextTrack.title.length > 50
                    ? nextTrack.title.substring(0, 50) + '...'
                    : nextTrack.title;
                embed.addFields({
                    name: 'Up Next',
                    value: `[${nextName}](${nextTrack.url})`,
                    inline: false
                });
            }

            // Add footer with queue info
            const totalInQueue = queue.tracks.size + 1;
            embed.setFooter({
                text: `${totalInQueue} song${totalInQueue !== 1 ? 's' : ''} in queue`
            });

            await interaction.reply({ embeds: [embed] });

            logger.debug(`Now playing displayed for guild: ${interaction.guildId}`);

        } catch (error) {
            logger.error(`Nowplaying command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Error', 'Failed to display current song information.')],
                ephemeral: true
            });
        }
    },
};
