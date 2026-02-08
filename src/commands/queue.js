/**
 * /queue Slash Command
 *
 * Displays the current song queue with pagination.
 */

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, queueEmbed } = require('../utils/embed');
const { QUEUE } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Display the current song queue')
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number to display')
                .setMinValue(1)
                .setRequired(false)
        ),

    async execute(interaction) {
        const queue = useQueue(interaction.guildId);

        // Check if there's an active queue
        if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
            return interaction.reply({
                embeds: [errorEmbed('Queue Empty', 'There are no songs in the queue. Use `/play` to add some!')],
                ephemeral: true
            });
        }

        try {
            const page = interaction.options.getInteger('page') || 1;
            const totalTracks = queue.tracks.size + (queue.currentTrack ? 1 : 0);
            const totalPages = Math.ceil(totalTracks / QUEUE.DISPLAY_LIMIT) || 1;

            // Validate page number
            if (page > totalPages) {
                return interaction.reply({
                    embeds: [errorEmbed('Invalid Page', `Page ${page} doesn't exist. The queue has ${totalPages} page${totalPages !== 1 ? 's' : ''}.`)],
                    ephemeral: true
                });
            }

            const embed = queueEmbed(queue, page, QUEUE.DISPLAY_LIMIT);

            await interaction.reply({ embeds: [embed] });

            logger.debug(`Queue displayed for guild: ${interaction.guildId} (page ${page}/${totalPages})`);

        } catch (error) {
            logger.error(`Queue command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Error', 'Failed to display the queue.')],
                ephemeral: true
            });
        }
    },
};
