/**
 * /stop Slash Command
 *
 * Stops playback, clears the queue, and disconnects from voice channel.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue'),

    /**
     * Execute the stop command
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice?.channel;

        // Validate user is in a voice channel
        if (!voiceChannel) {
            return interaction.reply({
                embeds: [errorEmbed('Not in Voice Channel', 'You must be in a voice channel to use this command.')],
                ephemeral: true
            });
        }

        const distube = interaction.client.distube;
        const queue = distube.getQueue(interaction.guildId);

        // Check if there's an active queue
        if (!queue) {
            return interaction.reply({
                embeds: [errorEmbed('Nothing Playing', 'There is no song currently playing.')],
                ephemeral: true
            });
        }

        // Check if user is in the same voice channel as the bot
        if (queue.voiceChannel?.id !== voiceChannel.id) {
            return interaction.reply({
                embeds: [errorEmbed('Wrong Channel', 'You must be in the same voice channel as the bot.')],
                ephemeral: true
            });
        }

        try {
            const songCount = queue.songs.length;

            // Stop playback and disconnect
            await distube.stop(interaction.guildId);

            await interaction.reply({
                embeds: [successEmbed(
                    'Stopped',
                    `Stopped playback and cleared **${songCount}** song${songCount !== 1 ? 's' : ''} from the queue.`
                )]
            });

            logger.info(`Stopped playback in guild: ${interaction.guildId}`);

        } catch (error) {
            logger.error(`Stop command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Stop Failed', 'Failed to stop playback.')],
                ephemeral: true
            });
        }
    },
};
