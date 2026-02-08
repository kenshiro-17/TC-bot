/**
 * /play Slash Command
 *
 * Plays a song from YouTube. Accepts:
 * - Direct YouTube URLs (video or playlist)
 * - Search queries (searches YouTube and plays first result)
 *
 * If a queue exists, the song is added to it.
 * If no queue exists, one is created and playback starts immediately.
 */

const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer, QueryType } = require('discord-player');
const { QUEUE } = require('../config/constants');
const { errorEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('YouTube URL or search query')
                .setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString('query');
        const member = interaction.member;
        const voiceChannel = member.voice?.channel;

        const respondError = async (title, message) => {
            const response = {
                embeds: [errorEmbed(title, message)],
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response);
            } else {
                await interaction.reply(response);
            }
        };

        // Validate user is in a voice channel
        if (!voiceChannel) {
            await respondError('Not in Voice Channel', 'You must be in a voice channel to use this command.');
            return;
        }

        // Check bot permissions in the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect')) {
            await respondError('Missing Permissions', 'I need permission to **Connect** to your voice channel.');
            return;
        }
        if (!permissions.has('Speak')) {
            await respondError('Missing Permissions', 'I need permission to **Speak** in your voice channel.');
            return;
        }

        const player = useMainPlayer();
        const existingQueue = player.queues.get(interaction.guildId);
        const currentCount = existingQueue ? existingQueue.tracks.size + (existingQueue.currentTrack ? 1 : 0) : 0;

        if (currentCount + 1 > QUEUE.MAX_SIZE) {
            await respondError(
                'Queue Full',
                `Queue is full (max ${QUEUE.MAX_SIZE}). Currently ${currentCount} in queue. Remove songs or wait for playback to finish.`
            );
            return;
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        try {
            // Normalize youtu.be short URLs to youtube.com/watch?v= format
            // so discord-player can correctly detect video ID + playlist params
            try {
                const url = new URL(query);
                if (url.host === 'youtu.be') {
                    const videoId = url.pathname.slice(1);
                    if (videoId) {
                        const params = new URLSearchParams(url.search);
                        params.set('v', videoId);
                        query = `https://www.youtube.com/watch?${params.toString()}`;
                        logger.info(`Normalized youtu.be URL to: ${query}`);
                    }
                }
            } catch {
                // Not a URL, treat as search query
            }

            // Search first so we can log the result and diagnose issues
            logger.info(`Searching for: ${query}`);
            const searchResult = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            logger.info(`Search result: hasTracks=${searchResult.hasTracks()}, extractor=${searchResult.extractor?.identifier || 'N/A'}, tracks=${searchResult.tracks?.length || 0}`);

            if (!searchResult.hasTracks()) {
                await interaction.editReply({
                    embeds: [errorEmbed('No Results', `No results found for **${query}**.`)]
                });
                return;
            }

            const { track } = await player.play(voiceChannel, searchResult, {
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel,
                        guild: interaction.guild,
                    },
                    volume: 80,
                    leaveOnEmpty: false,
                    leaveOnEnd: false,
                    leaveOnStop: false,
                    bufferingTimeout: 3000,
                },
                requestedBy: interaction.user,
            });

            await interaction.editReply({
                content: `Searching for **${query}**...`
            });

            // Delete the "Searching..." message after a short delay
            // since the player event will send its own embed
            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 2000);

        } catch (error) {
            logger.error(`Play command failed for query "${query}"`);
            logger.error(error.stack || error);

            let errorMessage = 'Failed to play the requested song.';

            if (error.message.includes('No result') || error.message.includes('no results')) {
                errorMessage = 'No results found for your search query.';
            } else if (error.message.includes('private')) {
                errorMessage = 'This video is private and cannot be played.';
            } else if (error.message.includes('age')) {
                errorMessage = 'This video is age-restricted. Configure YouTube cookies to access it.';
            }

            await interaction.editReply({
                embeds: [errorEmbed('Playback Failed', errorMessage)]
            });
        }
    },
};
