/**
 * DisTube Client Setup
 *
 * Configures DisTube with the yt-dlp plugin for reliable YouTube streaming.
 * Handles audio pipeline configuration and event handler registration.
 *
 * AUDIO PIPELINE EXPLANATION:
 * 1. User requests /play with a URL or search query
 * 2. DisTube passes the query to @distube/yt-dlp plugin
 * 3. yt-dlp extracts video metadata and audio stream URL
 *    - Uses browser-like request patterns to bypass 403 errors
 *    - Generates fresh signatures for each request
 * 4. DisTube fetches the audio stream
 * 5. FFmpeg (from ffmpeg-static) transcodes to Opus if needed
 * 6. @discordjs/opus encodes the final stream
 * 7. createAudioResource() wraps the stream with:
 *    - silencePaddingFrames: 5 (100ms jitter buffer)
 *    - Proper inputType for format detection
 * 8. AudioPlayer plays the resource to the VoiceConnection
 * 9. Audio is transmitted to Discord's voice gateway
 */

const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { AUDIO } = require('../config/constants');
const logger = require('../utils/logger');

// Import event handlers
const playSongHandler = require('../events/distube/playSong');
const addSongHandler = require('../events/distube/addSong');
const errorHandler = require('../events/distube/error');
const disconnectHandler = require('../events/distube/disconnect');
const finishHandler = require('../events/distube/finish');

// Store idle timeout timers per guild
const idleTimers = new Map();

/**
 * Setup voice state tracking for idle timeout
 * Leaves voice channel after IDLE_TIMEOUT when bot is alone
 * @param {Client} client - Discord.js client instance
 * @param {DisTube} distube - DisTube instance
 */
function setupIdleTimeout(client, distube) {
    client.on('voiceStateUpdate', (oldState, newState) => {
        // Check if this event involves the bot's voice channel
        const botVoice = distube.voices.get(oldState.guild.id) || distube.voices.get(newState.guild.id);
        if (!botVoice || !botVoice.channel) return;

        const botChannelId = botVoice.channel.id;
        const guildId = oldState.guild.id || newState.guild.id;

        // Only care about events in the bot's voice channel
        if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) return;

        // Get members in the bot's channel (excluding bots)
        const channel = botVoice.channel;
        const humanMembers = channel.members.filter(member => !member.user.bot);

        if (humanMembers.size === 0) {
            // Bot is alone, start idle timer if not already running
            if (!idleTimers.has(guildId)) {
                logger.info(`Bot is alone in voice channel, starting ${AUDIO.IDLE_TIMEOUT / 60000} minute idle timer for guild: ${guildId}`);

                const timer = setTimeout(async () => {
                    try {
                        // Double check we're still alone
                        const currentVoice = distube.voices.get(guildId);
                        if (currentVoice && currentVoice.channel) {
                            const currentHumans = currentVoice.channel.members.filter(m => !m.user.bot);
                            if (currentHumans.size === 0) {
                                logger.info(`Idle timeout reached, leaving voice channel in guild: ${guildId}`);

                                // Stop any playing music
                                const queue = distube.getQueue(guildId);
                                if (queue) {
                                    await distube.stop(guildId);
                                }

                                // Leave the voice channel
                                await distube.voices.leave(guildId);
                            }
                        }
                    } catch (error) {
                        logger.error(`Error during idle timeout leave: ${error.message}`);
                    } finally {
                        idleTimers.delete(guildId);
                    }
                }, AUDIO.IDLE_TIMEOUT);

                idleTimers.set(guildId, timer);
            }
        } else {
            // Someone is in the channel, cancel any idle timer
            if (idleTimers.has(guildId)) {
                logger.debug(`User joined voice channel, cancelling idle timer for guild: ${guildId}`);
                clearTimeout(idleTimers.get(guildId));
                idleTimers.delete(guildId);
            }
        }
    });

    logger.debug('Voice state idle timeout handler registered');
}

/**
 * Creates and configures the DisTube instance
 * @param {Client} client - Discord.js client instance
 * @returns {DisTube} Configured DisTube instance
 */
function createDistubeClient(client) {
    logger.info('Initializing DisTube client...');

    // Configure yt-dlp plugin options
    const ytDlpOptions = {
        update: true,
    };

    // Add cookies file if configured (for age-restricted content)
    if (process.env.YOUTUBE_COOKIES_PATH) {
        ytDlpOptions.cookies = process.env.YOUTUBE_COOKIES_PATH;
        logger.info('YouTube cookies configured for age-restricted content');
    }

    const distube = new DisTube(client, {
        // PLUGINS
        // yt-dlp provides reliable YouTube extraction, bypassing most 403 errors
        plugins: [new YtDlpPlugin(ytDlpOptions)],

        // QUEUE BEHAVIOR
        // Only emit playSong when a NEW song starts (not on unpause)
        emitNewSongOnly: true,

        // Don't emit addSong when creating a new queue (first song)
        // The playSong event will fire instead
        emitAddSongWhenCreatingQueue: false,

        // VOICE CONNECTION BEHAVIOR
        // Re-subscribe to AudioPlayer when bot is moved to different channel
        // This preserves the queue and continues playback
        joinNewVoiceChannel: true,

        // CONTENT FILTERING
        // Set to true to allow NSFW content in NSFW channels
        nsfw: false,

        // Save previous songs for DisTube#previous method
        savePreviousSongs: true,
    });

    // Register event handlers
    registerEventHandlers(distube);

    // Setup idle timeout for empty voice channels
    setupIdleTimeout(client, distube);

    logger.info('DisTube client initialized successfully');
    return distube;
}

/**
 * Register all DisTube event handlers
 */
function registerEventHandlers(distube) {
    // Now playing notification
    distube.on('playSong', playSongHandler);

    // Added to queue notification
    distube.on('addSong', addSongHandler);

    // Error handling (including 403 recovery)
    distube.on('error', errorHandler);

    // Voice disconnect handling
    distube.on('disconnect', disconnectHandler);

    // Queue finished
    distube.on('finish', finishHandler);

    // Additional useful events
    distube.on('initQueue', (queue) => {
        // Set default volume for new queues
        queue.setVolume(AUDIO.DEFAULT_VOLUME);
        logger.debug(`Queue initialized for guild: ${queue.id}`);
    });

    distube.on('addList', (queue, playlist) => {
        const channel = queue.textChannel;
        if (channel) {
            channel.send(`Added **${playlist.songs.length}** songs from **${playlist.name}** to the queue.`);
        }
        logger.info(`Playlist added: ${playlist.name} (${playlist.songs.length} songs)`);
    });

    // Debug events (only in debug mode)
    if (process.env.LOG_LEVEL === 'debug') {
        distube.on('debug', (message) => {
            logger.debug(`[DisTube Debug] ${message}`);
        });

        distube.on('ffmpegDebug', (message) => {
            logger.debug(`[FFmpeg Debug] ${message}`);
        });
    }

    logger.debug('DisTube event handlers registered');
}

module.exports = { createDistubeClient };
