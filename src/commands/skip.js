/**
 * /skip Slash Command
 *
 * Skips the currently playing song and moves to the next in queue.
 * If there are no more songs, the queue ends.
 */

const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    /**
     * Execute the skip command
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
            const currentSong = queue.songs[0];

            // Skip to next song
            // If there's only one song, this will end the queue
            if (queue.songs.length > 1) {
                await distube.skip(interaction.guildId);
                await interaction.reply({
                    embeds: [successEmbed('Skipped', `Skipped **${currentSong.name}**`)]
                });
            } else {
                // No more songs - stop playback
                await distube.stop(interaction.guildId);
                await interaction.reply({
                    embeds: [successEmbed('Skipped', `Skipped **${currentSong.name}**. Queue is now empty.`)]
                });
            }

            logger.info(`Skipped: ${currentSong.name}`);

        } catch (error) {
            logger.error(`Skip command error: ${error.message}`);

            await interaction.reply({
                embeds: [errorEmbed('Skip Failed', 'Failed to skip the current song.')],
                ephemeral: true
            });
        }
    },
};
