/**
 * /join Slash Command
 *
 * Makes the bot join the user's voice channel without playing music.
 * Useful for pre-connecting before playing songs.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your current voice channel'),

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

        // Check bot permissions in the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect')) {
            return interaction.reply({
                embeds: [errorEmbed('Missing Permissions', 'I need permission to **Connect** to your voice channel.')],
                ephemeral: true
            });
        }
        if (!permissions.has('Speak')) {
            return interaction.reply({
                embeds: [errorEmbed('Missing Permissions', 'I need permission to **Speak** in your voice channel.')],
                ephemeral: true
            });
        }

        try {
            // Check if bot is already in this voice channel
            const botVoice = interaction.guild.members.me?.voice;
            if (botVoice?.channel?.id === voiceChannel.id) {
                return interaction.reply({
                    embeds: [errorEmbed('Already Connected', `I'm already in ${voiceChannel.name}!`)],
                    ephemeral: true
                });
            }

            // Use discord-player to join (it handles voice connections internally)
            const { useMainPlayer } = require('discord-player');
            const player = useMainPlayer();

            // Create a queue for the guild to establish the voice connection
            const queue = player.queues.create(interaction.guildId, {
                metadata: {
                    channel: interaction.channel,
                    guild: interaction.guild,
                },
                volume: 80,
                leaveOnEmpty: false,
                leaveOnEnd: false,
                leaveOnStop: false,
            });

            await queue.connect(voiceChannel);

            await interaction.reply({
                embeds: [successEmbed('Joined Voice Channel', `Connected to **${voiceChannel.name}**. Use \`/play\` to start playing music!`)]
            });

            logger.info(`Joined voice channel: ${voiceChannel.name} in guild: ${interaction.guild.name}`);

        } catch (error) {
            logger.error(`Join command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Join Failed', 'Failed to join the voice channel. Please try again.')],
                ephemeral: true
            });
        }
    },
};
