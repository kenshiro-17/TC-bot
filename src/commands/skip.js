/**
 * /skip Slash Command
 *
 * Skips the currently playing song and moves to the next in queue.
 * If there are no more songs, the queue ends.
 */

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

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
        if (!queue || !queue.currentTrack) {
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
            const currentTrack = queue.currentTrack;

            if (queue.tracks.size > 0) {
                queue.node.skip();
                await interaction.reply({
                    embeds: [successEmbed('Skipped', `Skipped **${currentTrack.title}**`)]
                });
            } else {
                // No more songs - stop playback
                queue.delete();
                await interaction.reply({
                    embeds: [successEmbed('Skipped', `Skipped **${currentTrack.title}**. Queue is now empty.`)]
                });
            }

            logger.info(`Skipped: ${currentTrack.title}`);

        } catch (error) {
            logger.error(`Skip command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Skip Failed', 'Failed to skip the current song.')],
                ephemeral: true
            });
        }
    },
};
