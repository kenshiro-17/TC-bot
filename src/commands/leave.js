/**
 * /leave Slash Command
 *
 * Makes the bot leave the voice channel and clears the queue.
 */

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave the voice channel'),

    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice?.channel;

        // Check if bot is in a voice channel
        const botVoice = interaction.guild.members.me?.voice;
        if (!botVoice?.channel) {
            return interaction.reply({
                embeds: [errorEmbed('Not Connected', "I'm not in a voice channel.")],
                ephemeral: true
            });
        }

        // Validate user is in a voice channel
        if (!voiceChannel) {
            return interaction.reply({
                embeds: [errorEmbed('Not in Voice Channel', 'You must be in a voice channel to use this command.')],
                ephemeral: true
            });
        }

        // Check if user is in the same voice channel as the bot
        if (botVoice.channel.id !== voiceChannel.id) {
            return interaction.reply({
                embeds: [errorEmbed('Wrong Channel', 'You must be in the same voice channel as me.')],
                ephemeral: true
            });
        }

        try {
            const channelName = botVoice.channel.name || 'voice channel';

            // Destroy the queue if one exists (stops playback and disconnects)
            const queue = useQueue(interaction.guildId);
            if (queue) {
                queue.delete();
            }

            await interaction.reply({
                embeds: [successEmbed('Left Voice Channel', `Disconnected from **${channelName}**. See you later!`)]
            });

            logger.info(`Left voice channel: ${channelName} in guild: ${interaction.guild.name}`);

        } catch (error) {
            logger.error(`Leave command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Leave Failed', 'Failed to leave the voice channel. Please try again.')],
                ephemeral: true
            });
        }
    },
};
