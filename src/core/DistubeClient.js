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

const { AUDIO } = require('../config/constants');
const logger = require('../utils/logger');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { spawnSync } = require('child_process');

const streamPipeline = promisify(pipeline);

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
async function downloadFile(url, destination) {
    await new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return resolve(downloadFile(response.headers.location, destination));
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url} (status ${response.statusCode})`));
                return;
            }

            streamPipeline(response, fs.createWriteStream(destination))
                .then(resolve)
                .catch(reject);
        }).on('error', reject);
    });
}

async function ensureYtDlpBinary() {
    const platformExt = process.platform === 'win32' ? '.exe' : '';
    const ytDlpDir = process.env.YTDLP_DIR || path.join('/tmp', 'yt-dlp');
    const ytDlpFilename = process.env.YTDLP_FILENAME || `yt-dlp${platformExt}`;
    const ytDlpPath = path.join(ytDlpDir, ytDlpFilename);

    process.env.YTDLP_DIR = ytDlpDir;
    process.env.YTDLP_FILENAME = ytDlpFilename;

    if (fs.existsSync(ytDlpPath)) {
        logger.info(`yt-dlp binary found at ${ytDlpPath}`);
        return;
    }

    const url = process.env.YTDLP_URL || `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpFilename}`;

    try {
        await fs.promises.mkdir(ytDlpDir, { recursive: true });
        await downloadFile(url, ytDlpPath);
        await fs.promises.chmod(ytDlpPath, 0o755);
        logger.info(`yt-dlp binary downloaded to ${ytDlpPath}`);
    } catch (error) {
        logger.error(`Failed to download yt-dlp binary: ${error.message}`);
        const pythonCheck = spawnSync('python3', ['--version'], { encoding: 'utf8' });
        if (pythonCheck.status !== 0) {
            logger.error('python3 is not available and yt-dlp binary could not be downloaded.');
            logger.error('Railway fix: ensure outbound access to GitHub or install python3.');
            process.exit(1);
        }
        logger.warn('python3 is available; yt-dlp may still run if a script is present.');
    }
}

async function createDistubeClient(client) {
    logger.info('Initializing DisTube client...');

    let ffmpegPath = null;

    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
        logger.info(`FFmpeg path set to ffmpeg-static: ${ffmpegStatic}`);
    } else {
        const whichResult = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
        if (whichResult.status === 0) {
            const detectedPath = (whichResult.stdout || '').trim();
            if (detectedPath) {
                ffmpegPath = detectedPath;
                logger.info(`FFmpeg path detected on PATH: ${detectedPath}`);
            }
        }
    }

    if (ffmpegPath) {
        process.env.FFMPEG_PATH = ffmpegPath;
    } else {
        logger.error('FFmpeg not found. Install ffmpeg or ensure ffmpeg-static is available.');
        logger.error('Railway fix: set NIXPACKS_PKGS=ffmpeg and redeploy.');
        process.exit(1);
    }

    await ensureYtDlpBinary();

    const { DisTube } = require('distube');
    const { YtDlpPlugin } = require('@distube/yt-dlp');

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
        // FFmpeg binary override (needed for some hosts)
        ffmpeg: {
            path: ffmpegPath,
        },

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
