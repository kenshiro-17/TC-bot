/**
 * Discord.js interactionCreate Event Handler
 *
 * Handles all incoming interactions (slash commands, buttons, etc.)
 * Routes slash commands to their respective handlers.
 */

const { errorEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    once: false, // Fire on every interaction

    /**
     * Handle interactionCreate event
     * @param {Interaction} interaction - The interaction that was created
     */
    async execute(interaction) {
        // Only handle slash commands for now
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`Unknown command: ${interaction.commandName}`);
            return interaction.reply({
                embeds: [errorEmbed('Unknown Command', 'This command does not exist.')],
                ephemeral: true
            });
        }

        try {
            logger.debug(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
            await command.execute(interaction);

        } catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);

            // Send error response
            const errorResponse = {
                embeds: [errorEmbed('Command Error', 'An error occurred while executing this command.')],
                ephemeral: true
            };

            // Handle both deferred and non-deferred interactions
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorResponse).catch(() => {});
            } else {
                await interaction.reply(errorResponse).catch(() => {});
            }
        }
    },
};
