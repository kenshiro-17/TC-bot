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

        // Defer reply since fetching video info may take time
        await interaction.deferReply();

        try {
            const distube = interaction.client.distube;

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
            logger.error(`Play command error: ${error.message}`);

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
