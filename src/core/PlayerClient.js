/**
 * Discord Player Client Setup
 *
 * Configures discord-player with the YoutubeiExtractor for reliable YouTube streaming.
 * Replaces DisTube + yt-dlp with a more stable extraction pipeline.
 *
 * AUDIO PIPELINE:
 * 1. User requests /play with a URL or search query
 * 2. discord-player passes the query to YoutubeiExtractor
 * 3. youtubei.js extracts video metadata and audio stream URL
 * 4. FFmpeg transcodes to Opus if needed
 * 5. discord-voip streams audio to the voice connection
 * 6. Discord voice gateway receives Opus packets
 */

const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');
const { DefaultExtractors } = require('@discord-player/extractor');
const { AUDIO } = require('../config/constants');
const logger = require('../utils/logger');
const fs = require('fs');
const { PassThrough } = require('stream');

// Store idle timeout timers per guild
const idleTimers = new Map();

/**
 * Setup voice state tracking for idle timeout
 * Leaves voice channel after IDLE_TIMEOUT when bot is alone
 * @param {Client} client - Discord.js client instance
 * @param {Player} player - discord-player instance
 */
function setupIdleTimeout(client, player) {
    client.on('voiceStateUpdate', (oldState, newState) => {
        const guildId = oldState.guild.id || newState.guild.id;
        const queue = player.queues.get(guildId);

        if (!queue || !queue.channel) return;

        const botChannelId = queue.channel.id;

        // Only care about events in the bot's voice channel
        if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) return;

        // Get members in the bot's channel (excluding bots)
        const channel = queue.channel;
        const humanMembers = channel.members.filter(member => !member.user.bot);

        if (humanMembers.size === 0) {
            // Bot is alone, start idle timer if not already running
            if (!idleTimers.has(guildId)) {
                logger.info(`Bot is alone in voice channel, starting ${AUDIO.IDLE_TIMEOUT / 60000} minute idle timer for guild: ${guildId}`);

                const timer = setTimeout(async () => {
                    try {
                        const currentQueue = player.queues.get(guildId);
                        if (currentQueue && currentQueue.channel) {
                            const currentHumans = currentQueue.channel.members.filter(m => !m.user.bot);
                            if (currentHumans.size === 0) {
                                logger.info(`Idle timeout reached, leaving voice channel in guild: ${guildId}`);
                                currentQueue.delete();
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
 * Creates and configures the discord-player instance
 * @param {Client} client - Discord.js client instance
 * @returns {Player} Configured Player instance
 */
async function createPlayerClient(client) {
    logger.info('Initializing discord-player client...');

    // Set FFmpeg path from ffmpeg-static if available
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
            process.env.FFMPEG_PATH = ffmpegStatic;
            logger.info(`FFmpeg path set to ffmpeg-static: ${ffmpegStatic}`);
        }
    } catch {
        logger.warn('ffmpeg-static not available, relying on system FFmpeg');
    }

    const player = new Player(client, {
        // Enable debug logging to diagnose extraction issues
        skipFFmpeg: false,
    });

    // Always enable debug listener for player-level diagnostics
    player.on('debug', (message) => {
        logger.debug(`[Player] ${message}`);
    });

    // Register YoutubeiExtractor FIRST so it handles YouTube URLs
    // before any default extractor can claim them.
    const baseOptions = {
        streamOptions: {
            useClient: 'IOS',
        },
        // Custom stream to avoid short/empty streams on Windows
        createStream: async (track, extractor) => {
            const ext = extractor ?? YoutubeiExtractor.getInstance?.();
            const innertube = ext?.innerTube;
            if (!innertube) {
                throw new Error('YoutubeiExtractor is not initialized');
            }

            let videoId = null;
            try {
                const url = new URL(track.url);
                videoId = url.searchParams.get('v') || url.pathname.split('/').pop();
            } catch {
                videoId = track.url.split('v=').pop();
            }

            logger.debug(`[Stream] Fetching video info for ID: ${videoId}`);
            const info = await innertube.getBasicInfo(videoId, { client: 'IOS' });
            const cpn = info?.cpn || info?.player_response?.cpn || '';

            const format = info.chooseFormat
                ? info.chooseFormat({ quality: 'best', type: 'audio', format: 'mp4' })
                : (info?.formats?.[0] || info?.streaming_data?.formats?.[0]);

            if (!format) throw new Error('No audio format available');

            const contentLength = Number(format.content_length ?? format.contentLength ?? 0);
            let streamUrl = format.url;

            if (!streamUrl && typeof format.decipher === 'function' && innertube.session?.player) {
                streamUrl = format.decipher(innertube.session.player);
            }

            if (!streamUrl) throw new Error('No stream URL available');

            const pass = new PassThrough();
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
            const ua = 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)';
            logger.debug(`[Stream] Using URL (len=${streamUrl.length}) contentLength=${contentLength || 'unknown'}`);
            const cookieHeader = ext?.options?.cookie
                ? ext.options.cookie
                      .split('\n')
                      .filter(line => line && !line.startsWith('#'))
                      .map(line => line.split('\t'))
                      .map(parts => `${parts[5]}=${parts[6]}`)
                      .join('; ')
                : '';

            (async () => {
                try {
                    let start = 0;
                    const total = contentLength || 0;
                    let part = 0;
                    let bytesWritten = 0;

                    const noDataTimer = setTimeout(() => {
                        if (bytesWritten === 0) {
                            logger.error('[Stream] No data received from CDN within timeout');
                            pass.destroy(new Error('No data received from CDN'));
                        }
                    }, 8000);

                    const buildUrl = (s, e) => {
                        try {
                            const u = new URL(streamUrl);
                            u.searchParams.set('range', `${s}-${e}`);
                            if (cpn) u.searchParams.set('cpn', cpn);
                            return u.toString();
                        } catch {
                            return streamUrl;
                        }
                    };

                    // If content length unknown, do a single request without range
                    if (!total) {
                        const resp = await innertube.session.http.fetch_function(streamUrl, {
                            headers: {
                                'User-Agent': ua,
                                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
                                'Origin': 'https://www.youtube.com',
                                'Referer': 'https://www.youtube.com/',
                            },
                        });
                        if (!resp.ok || !resp.body) {
                            throw new Error(`CDN response ${resp.status}`);
                        }
                        for await (const chunk of resp.body) {
                            bytesWritten += chunk.length ?? chunk.byteLength ?? 0;
                            if (!pass.write(Buffer.from(chunk))) {
                                await new Promise(resolve => pass.once('drain', resolve));
                            }
                        }
                        clearTimeout(noDataTimer);
                        pass.end();
                        return;
                    }

                    while (start < total) {
                        const end = Math.min(start + CHUNK_SIZE - 1, total - 1);
                        const urlWithRange = buildUrl(start, end);
                        const resp = await innertube.session.http.fetch_function(urlWithRange, {
                            headers: {
                                'User-Agent': ua,
                                'Accept': '*/*',
                                ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
                                'Origin': 'https://www.youtube.com',
                                'Referer': 'https://www.youtube.com/',
                            },
                        });

                        if (!resp.ok || !resp.body) {
                            logger.error(`[Stream] CDN response ${resp.status} for range ${start}-${end}`);
                            throw new Error(`CDN response ${resp.status}`);
                        }

                        let wrote = 0;
                        for await (const chunk of resp.body) {
                            wrote += chunk.length ?? chunk.byteLength ?? 0;
                            bytesWritten += chunk.length ?? chunk.byteLength ?? 0;
                            if (!pass.write(Buffer.from(chunk))) {
                                await new Promise(resolve => pass.once('drain', resolve));
                            }
                        }

                        if (wrote === 0) {
                            logger.debug('[Stream] Empty body for range request, trying full fetch...');
                            const fullResp = await innertube.session.http.fetch_function(streamUrl, {
                                headers: {
                                    'User-Agent': ua,
                                    'Accept': '*/*',
                                    ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
                                    'Origin': 'https://www.youtube.com',
                                    'Referer': 'https://www.youtube.com/',
                                },
                            });
                            if (!fullResp.ok || !fullResp.body) {
                                logger.error(`[Stream] CDN full response ${fullResp.status}`);
                                throw new Error(`CDN full response ${fullResp.status}`);
                            }
                            for await (const chunk of fullResp.body) {
                                bytesWritten += chunk.length ?? chunk.byteLength ?? 0;
                                if (!pass.write(Buffer.from(chunk))) {
                                    await new Promise(resolve => pass.once('drain', resolve));
                                }
                            }
                            clearTimeout(noDataTimer);
                            pass.end();
                            return;
                        }

                        part += 1;
                        logger.debug(`[Stream] Chunk ${part}: ${start}-${end}`);
                        start = end + 1;
                    }

                    logger.debug('[Stream] Download complete');
                    clearTimeout(noDataTimer);
                    pass.end();
                } catch (err) {
                    logger.error(`[Stream] Download error: ${err.message}`);
                    pass.destroy(err);
                }
            })();

            return pass;
        },
    };

    let usedCookies = false;

    // Try with cookies if configured
    if (process.env.YOUTUBE_COOKIES_PATH) {
        try {
            const cookieContent = fs.readFileSync(process.env.YOUTUBE_COOKIES_PATH, 'utf8');
            const optionsWithCookies = { ...baseOptions, cookie: cookieContent };

            await player.extractors.register(YoutubeiExtractor, optionsWithCookies);
            logger.info('YoutubeiExtractor registered with cookies');

            // Verify the extractor actually works with a test search
            const testResult = await player.search('youtube test video', {});
            if (testResult.hasTracks()) {
                logger.info('YoutubeiExtractor verification passed (with cookies)');
                usedCookies = true;
            } else {
                // Do not fallback; some cookie sets fail search but still unlock CDN downloads
                logger.warn('YoutubeiExtractor search failed with cookies, forcing cookies anyway for CDN access...');
                usedCookies = true;
            }
        } catch (error) {
            logger.warn(`Cookie-based registration failed: ${error.message}`);
            // Try to unregister in case it was partially registered
            try {
                await player.extractors.unregister('com.retrouser955.discord-player.discord-player-youtubei');
            } catch { /* ignore */ }
        }
    }

    // Register without cookies if we haven't successfully registered yet
    if (!usedCookies) {
        await player.extractors.register(YoutubeiExtractor, baseOptions);
        logger.info('YoutubeiExtractor registered without cookies');

        // Verify it works
        try {
            const testResult = await player.search('youtube test video', {});
            if (testResult.hasTracks()) {
                logger.info('YoutubeiExtractor verification passed (no cookies)');
            } else {
                logger.warn('YoutubeiExtractor verification failed - YouTube searches may not work');
            }
        } catch (error) {
            logger.warn(`YoutubeiExtractor verification error: ${error.message}`);
        }
    }

    // Load default extractors (SoundCloud, Spotify, Vimeo, etc.)
    // Note: YouTube extractors were already removed from defaults in discord-player v7
    await player.extractors.loadMulti(DefaultExtractors);
    logger.info('Default extractors loaded');

    // Log all registered extractors for diagnostics
    const extractorNames = [...player.extractors.store.keys()];
    logger.info(`Registered extractors: ${extractorNames.join(', ')}`);

    // Register player event handlers
    registerEventHandlers(player);

    // Setup idle timeout for empty voice channels
    setupIdleTimeout(client, player);

    logger.info('discord-player client initialized successfully');
    return player;
}

/**
 * Register all player event handlers
 */
function registerEventHandlers(player) {
    const { nowPlayingEmbed, addedToQueueEmbed, errorEmbed, infoEmbed } = require('../utils/embed');

    // Now playing notification
    player.events.on('playerStart', (queue, track) => {
        const channel = queue.metadata?.channel;
        if (!channel) {
            logger.warn('No text channel available for playerStart notification');
            return;
        }

        try {
            const embed = nowPlayingEmbed(track, queue);
            channel.send({ embeds: [embed] });
            logger.info(`Now playing: ${track.title} in ${queue.channel?.name || 'unknown channel'}`);
        } catch (error) {
            logger.error('Failed to send now playing message:', error.message);
        }
    });

    // Song added to queue notification
    player.events.on('audioTrackAdd', (queue, track) => {
        const channel = queue.metadata?.channel;
        if (!channel) return;

        try {
            const position = queue.tracks.size;
            const embed = addedToQueueEmbed(track, position);
            channel.send({ embeds: [embed] });
            logger.info(`Added to queue: ${track.title} (position #${position})`);
        } catch (error) {
            logger.error('Failed to send added to queue message:', error.message);
        }
    });

    // Playlist added notification
    player.events.on('audioTracksAdd', (queue, tracks) => {
        const channel = queue.metadata?.channel;
        if (!channel) return;

        try {
            channel.send(`Added **${tracks.length}** songs to the queue.`);
            logger.info(`Playlist added: ${tracks.length} songs`);
        } catch (error) {
            logger.error('Failed to send playlist added message:', error.message);
        }
    });

    // Error handling
    player.events.on('playerError', (queue, error) => {
        const channel = queue.metadata?.channel;
        const errorMessage = error.message || 'Unknown error';

        logger.error(`Player error: ${errorMessage}`);

        if (channel) {
            let title = 'Playback Error';
            let description = 'An error occurred during playback.';

            if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                title = 'Video Unavailable';
                description = 'This video cannot be played. It may be region-locked or temporarily unavailable. Skipping to next track...';
            } else if (errorMessage.includes('private')) {
                title = 'Private Video';
                description = 'This video is private and cannot be played.';
            } else if (errorMessage.includes('age') || errorMessage.includes('Sign in')) {
                title = 'Age-Restricted Content';
                description = 'This video requires age verification. Configure YouTube cookies to access age-restricted content.';
            } else if (errorMessage.includes('network') || errorMessage.includes('ECONNRESET')) {
                title = 'Network Error';
                description = 'A network error occurred. The bot will attempt to continue with the next track.';
            }

            channel.send({ embeds: [errorEmbed(title, description)] }).catch(() => {});
        }

        if (error.stack) {
            logger.debug(`Error stack: ${error.stack}`);
        }
    });

    // Track skipped (stream extraction failure or manual skip)
    player.events.on('playerSkip', (queue, track, reason, description) => {
        logger.warn(`Track skipped: "${track.title}" | reason=${reason} | ${description}`);

        if (reason === 'ERR_NO_STREAM') {
            const channel = queue.metadata?.channel;
            if (channel) {
                channel.send({
                    embeds: [errorEmbed('Stream Error', `Could not stream **${track.title}**. Skipping...`)]
                }).catch(() => {});
            }
        }
    });

    // General error handler
    player.events.on('error', (queue, error) => {
        logger.error(`General player error: ${error.message}`);
    });

    // Track finished playing (stream ended)
    player.events.on('playerFinish', (queue, track) => {
        logger.info(`Track finished: "${track.title}" (stream ended normally or prematurely)`);
    });

    // Queue finished
    player.events.on('emptyQueue', (queue) => {
        const channel = queue.metadata?.channel;
        logger.info(`Queue finished in guild: ${queue.guild.id}`);

        if (channel) {
            let description = 'The queue has finished playing.';
            if (AUDIO.IDLE_TIMEOUT > 0) {
                const minutes = Math.floor(AUDIO.IDLE_TIMEOUT / 60000);
                description += ` I'll leave the channel in ${minutes} minute${minutes !== 1 ? 's' : ''} if no new songs are added.`;
            }
            channel.send({ embeds: [infoEmbed('Queue Finished', description)] }).catch(() => {});
        }
    });

    // Voice channel disconnect
    player.events.on('disconnect', (queue) => {
        const channel = queue.metadata?.channel;
        const voiceChannelName = queue.channel?.name || 'the voice channel';

        logger.info(`Disconnected from voice channel in guild: ${queue.guild.id}`);

        if (channel) {
            channel.send({
                embeds: [infoEmbed('Disconnected', `Left ${voiceChannelName}. The queue has been cleared.`)]
            }).catch(() => {});
        }
    });

    player.events.on('debug', (queue, message) => {
        logger.debug(`[Player Debug] ${message}`);
    });

    logger.debug('Player event handlers registered');
}

module.exports = { createPlayerClient };
