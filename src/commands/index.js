/**
 * Command Loader & Registration
 *
 * Loads all slash commands from this directory and registers them with Discord.
 * Supports both guild-specific (instant) and global (up to 1 hour) registration.
 */

const { Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load all command files and attach them to the client
 * @param {Client} client - Discord.js client instance
 * @returns {Collection} Collection of loaded commands
 */
function loadCommands(client) {
    client.commands = new Collection();

    const commandsPath = __dirname;
    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => file.endsWith('.js') && file !== 'index.js');

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        // Validate command structure
        if (!command.data || !command.execute) {
            logger.warn(`Command ${file} is missing required "data" or "execute" property`);
            continue;
        }

        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: ${command.data.name}`);
    }

    logger.info(`Loaded ${client.commands.size} commands`);
    return client.commands;
}

/**
 * Register slash commands with Discord API
 * @param {Client} client - Discord.js client instance
 */
async function registerCommands(client) {
    const commands = [];

    // Collect command data for registration
    for (const command of client.commands.values()) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        logger.info(`Registering ${commands.length} slash commands...`);

        // Check if we should register to a specific guild (faster for development)
        // or globally (takes up to 1 hour to propagate)
        if (process.env.GUILD_ID) {
            // Guild-specific registration (instant)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            logger.info(`Registered ${commands.length} commands to guild: ${process.env.GUILD_ID}`);
        } else {
            // Global registration (up to 1 hour)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            logger.info(`Registered ${commands.length} commands globally`);
        }

    } catch (error) {
        logger.error('Failed to register slash commands:', error);
        throw error;
    }
}

module.exports = {
    loadCommands,
    registerCommands,
};
