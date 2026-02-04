/**
 * Channel Guard Utility
 *
 * Ensures that music commands are only used in the designated #music-requests channel.
 * If the channel doesn't exist, it will be created automatically.
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { CHANNELS } = require('../config/constants');
const { errorEmbed, infoEmbed } = require('./embed');
const logger = require('./logger');

/**
 * Ensures the interaction is in the music-requests channel
 * @param {ChatInputCommandInteraction} interaction - The interaction to check
 * @returns {Promise<boolean>} True if the command should proceed, false otherwise
 */
async function ensureMusicChannel(interaction) {
    const channelName = CHANNELS.MUSIC_REQUESTS_NAME;
    const currentChannel = interaction.channel;

    // Check if we're already in the music-requests channel
    if (currentChannel.name === channelName) {
        return true;
    }

    // Look for an existing music-requests channel in the guild
    const existingChannel = interaction.guild.channels.cache.find(
        ch => ch.name === channelName && ch.type === ChannelType.GuildText
    );

    if (existingChannel) {
        // Channel exists, redirect the user
        await interaction.reply({
            embeds: [errorEmbed(
                'Wrong Channel',
                `Please use ${existingChannel} for music commands.`
            )],
            ephemeral: true
        });
        return false;
    }

    // Channel doesn't exist, try to create it
    try {
        const newChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            topic: 'Use this channel for music bot commands. Type /play to start!',
            permissionOverwrites: [
                {
                    id: interaction.guild.id, // @everyone
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
                {
                    id: interaction.client.user.id, // Bot
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
            ],
        });

        logger.info(`Created #${channelName} channel in guild: ${interaction.guild.name}`);

        await interaction.reply({
            embeds: [infoEmbed(
                'Channel Created',
                `I've created ${newChannel} for music commands. Please use that channel!`
            )],
            ephemeral: true
        });
        return false;

    } catch (error) {
        logger.error(`Failed to create #${channelName} channel:`, error.message);

        // Couldn't create channel (probably missing permissions)
        await interaction.reply({
            embeds: [errorEmbed(
                'Setup Required',
                `Please create a \`#${channelName}\` channel for music commands, or grant me permission to create channels.`
            )],
            ephemeral: true
        });
        return false;
    }
}

module.exports = { ensureMusicChannel };
