/**
 * /nowplaying Slash Command
 *
 * Displays information about the currently playing song with a progress bar.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed, formatDuration, createProgressBar } = require('../utils/embed');
const { COLORS } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song'),

    /**
     * Execute the nowplaying command
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const distube = interaction.client.distube;
        const queue = distube.getQueue(interaction.guildId);

        // Check if there's an active queue with a playing song
        if (!queue || !queue.songs.length) {
            return interaction.reply({
                embeds: [errorEmbed('Nothing Playing', 'There is no song currently playing. Use `/play` to start!')],
                ephemeral: true
            });
        }

        try {
            const song = queue.songs[0];
            const currentTime = queue.currentTime;
            const duration = song.duration;

            // Create progress bar
            const progressBar = createProgressBar(currentTime, duration);
            const timeDisplay = `${formatDuration(currentTime)} / ${formatDuration(duration)}`;

            // Build the embed
            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('Now Playing')
                .setDescription(`[${song.name}](${song.url})`)
                .addFields(
                    {
                        name: 'Progress',
                        value: `${progressBar}\n\`${timeDisplay}\``,
                        inline: false
                    },
                    {
                        name: 'Requested by',
                        value: song.user?.toString() || 'Unknown',
                        inline: true
                    },
                    {
                        name: 'Volume',
                        value: `${queue.volume}%`,
                        inline: true
                    }
                );

            // Add thumbnail if available
            if (song.thumbnail) {
                embed.setThumbnail(song.thumbnail);
            }

            // Show up next if there are more songs
            if (queue.songs.length > 1) {
                const nextSong = queue.songs[1];
                const nextName = nextSong.name.length > 50
                    ? nextSong.name.substring(0, 50) + '...'
                    : nextSong.name;
                embed.addFields({
                    name: 'Up Next',
                    value: `[${nextName}](${nextSong.url})`,
                    inline: false
                });
            }

            // Add footer with queue info
            embed.setFooter({
                text: `${queue.songs.length} song${queue.songs.length !== 1 ? 's' : ''} in queue`
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
