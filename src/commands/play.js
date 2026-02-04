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

    /**
     * Execute the play command
     * @param {ChatInputCommandInteraction} interaction
     */
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

        const distube = interaction.client.distube;
        const queue = distube.getQueue(interaction.guildId);
        const currentCount = queue?.songs?.length || 0;

        if (currentCount + 1 > QUEUE.MAX_SIZE) {
            await respondError(
                'Queue Full',
                `Queue is full (max ${QUEUE.MAX_SIZE}). Currently ${currentCount} in queue. Remove songs or wait for playback to finish.`
            );
            return;
        }

        if (!interaction.deferred && !interaction.replied) {
            // Defer reply since fetching video info may take time
            await interaction.deferReply({ ephemeral: true });
        }

        try {
            // DisTube handles everything:
            // - URL validation
            // - Search if query is not a URL
            // - Queue creation/addition
            // - Voice connection
            // - Audio streaming
            await distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: member,
            });

            // DisTube will emit 'playSong' or 'addSong' event
            // which sends the appropriate embed
            // We just confirm the command was received
            await interaction.editReply({
                content: `Searching for **${query}**...`
            });

            // Delete the "Searching..." message after a short delay
            // since DisTube will send its own embed
            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 2000);

        } catch (error) {
            // Enhanced error logging with stack trace and query context
            logger.error(`Play command failed for query "${query}"`);
            logger.error(error.stack || error);

            // Handle specific error cases
            let errorMessage = 'Failed to play the requested song.';

            if (error.message.includes('No result')) {
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
