/**
 * Discord Music Bot - Entry Point
 *
 * High-performance Discord music bot using:
 * - discord.js v14 for Discord API interaction
 * - discord-player with discord-player-youtubei for YouTube streaming
 *
 * ARCHITECTURE OVERVIEW:
 * +-------------------------------------------------------------+
 * |                     Discord Client                           |
 * |  +-------------+  +-------------+  +------------------+     |
 * |  |   Commands  |  |   Events    |  |  discord-player  |     |
 * |  |  /play      |  |  ready      |  |  +------------+  |     |
 * |  |  /skip      |  |  interact.  |  |  | youtubei   |  |     |
 * |  |  /stop      |  |             |  |  | extractor  |  |     |
 * |  |  /queue     |  |  playerStart|  |  +------------+  |     |
 * |  +-------------+  |  audioTrack |  |                  |     |
 * |                    |  error      |  |  Queue Manager   |     |
 * |                    |  emptyQueue |  |  Voice Handler   |     |
 * |                    |  disconnect |  |  Audio Pipeline  |     |
 * |                    +-------------+  +------------------+     |
 * +-------------------------------------------------------------+
 *
 * AUDIO PIPELINE:
 * 1. /play command triggers player.play()
 * 2. YoutubeiExtractor extracts video info via youtubei.js
 * 3. Audio stream URL is fetched (bypasses 403 via InnerTube API)
 * 4. FFmpeg transcodes to Opus if needed
 * 5. discord-voip streams audio to VoiceConnection
 * 6. Discord voice gateway receives Opus packets
 *
 * CRITICAL REQUIREMENTS:
 * - GatewayIntentBits.GuildVoiceStates MUST be enabled
 * - ffmpeg must be available (system or ffmpeg-static)
 * - Bot needs Connect + Speak permissions in voice channels
 */

// Load environment variables FIRST
require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./src/commands');
const { createPlayerClient } = require('./src/core/PlayerClient');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

// Validate required environment variables
function validateEnvironment() {
    const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        logger.error('Copy .env.example to .env and fill in your values.');
        process.exit(1);
    }
}

function configureYouTubeCookies() {
    const base64 = process.env.YOUTUBE_COOKIES_BASE64;
    if (!base64) return;

    const trimmed = base64.trim().replace(/^['"]|['"]$/g, '');
    const cookiesPath = path.join('/tmp', 'youtube-cookies.txt');

    let decoded = '';
    let usedRaw = false;

    // Allow raw Netscape cookies directly (helpful if env var wasn't base64)
    if (trimmed.startsWith('# Netscape')) {
        decoded = trimmed;
        usedRaw = true;
    } else {
        try {
            decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        } catch (error) {
            logger.error(`Failed to decode YOUTUBE_COOKIES_BASE64: ${error.message}`);
            return;
        }
    }

    const firstLine = (decoded.split('\n')[0] || '').trim();
    if (!firstLine.startsWith('# Netscape HTTP Cookie File')) {
        if (firstLine.startsWith('{\\rtf')) {
            logger.error('YouTube cookies look like an RTF file. Re-export as a plain text Netscape cookies file.');
        } else {
            logger.error(`YouTube cookies are not in Netscape format (first line: ${firstLine || '<empty>'}).`);
        }
        logger.error('Skipping cookie setup. Export cookies.txt as plain text and base64-encode it.');
        return;
    }

    fs.writeFileSync(cookiesPath, decoded, { encoding: 'utf8' });
    process.env.YOUTUBE_COOKIES_PATH = cookiesPath;
    logger.info(`YouTube cookies loaded ${usedRaw ? 'from raw text' : 'from base64'} into ${cookiesPath}`);
}

// Create Discord client with required intents
function createClient() {
    return new Client({
        intents: [
            // Required for receiving guild events
            GatewayIntentBits.Guilds,

            // CRITICAL: Required for voice state tracking
            // Without this, voice connections will stay stuck in "Signalling" state
            // and no audio will play!
            GatewayIntentBits.GuildVoiceStates,

            // Required for tracking voice channel membership (idle timeout)
            GatewayIntentBits.GuildMembers,
        ],
    });
}

// Load event handlers from events directory
function loadEvents(client) {
    const eventsPath = path.join(__dirname, 'src', 'events');
    const eventFiles = fs.readdirSync(eventsPath)
        .filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }

        logger.debug(`Loaded event: ${event.name}`);
    }

    logger.info(`Loaded ${eventFiles.length} event handlers`);
}

// Graceful shutdown handler
function setupShutdownHandlers(client) {
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);

        try {
            // Destroy all queues
            if (client.player) {
                for (const queue of client.player.queues.cache.values()) {
                    queue.delete();
                }
            }

            // Destroy client connection
            client.destroy();
            logger.info('Bot shut down successfully');
            process.exit(0);

        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Main entry point
async function main() {
    logger.info('Starting Discord Music Bot...');

    // Validate environment
    validateEnvironment();

    // Load YouTube cookies if provided
    configureYouTubeCookies();

    // Create Discord client
    const client = createClient();

    // Load commands
    loadCommands(client);

    // Load event handlers
    loadEvents(client);

    // Initialize discord-player
    // This must happen AFTER client creation but BEFORE login
    client.player = await createPlayerClient(client);

    // Setup graceful shutdown
    setupShutdownHandlers(client);

    // Login to Discord
    try {
        logger.info('Connecting to Discord...');
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to login to Discord:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start the bot
main();
