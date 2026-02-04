/**
 * Discord.js ready Event Handler
 *
 * Fires once when the bot successfully logs in and is ready.
 * Handles command registration and startup logging.
 */

const { registerCommands } = require('../commands');
const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true, // Only fire once

    /**
     * Handle ready event
     * @param {Client} client - Discord.js client instance
     */
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}`);
        logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

        // Register slash commands
        try {
            await registerCommands(client);
        } catch (error) {
            logger.error('Failed to register commands on startup:', error);
        }

        // Set bot activity/presence
        client.user.setActivity('music | /play', { type: 2 }); // Type 2 = Listening

        logger.info('Bot is ready!');
    },
};
