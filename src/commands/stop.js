/**
 * /stop Slash Command
 *
 * Stops playback, clears the queue, and disconnects from voice channel.
 */

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear the queue'),

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

        const queue = useQueue(interaction.guildId);

        // Check if there's an active queue
        if (!queue) {
            return interaction.reply({
                embeds: [errorEmbed('Nothing Playing', 'There is no song currently playing.')],
                ephemeral: true
            });
        }

        // Check if user is in the same voice channel as the bot
        if (queue.channel?.id !== voiceChannel.id) {
            return interaction.reply({
                embeds: [errorEmbed('Wrong Channel', 'You must be in the same voice channel as the bot.')],
                ephemeral: true
            });
        }

        try {
            const songCount = queue.tracks.size + (queue.currentTrack ? 1 : 0);

            // Stop playback and destroy the queue (disconnects from voice)
            queue.delete();

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
