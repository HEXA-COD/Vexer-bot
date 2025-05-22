// commands/help.js
const fs = require("fs");
const path = require("path");
const config = require("../config.json");

module.exports = {
  name: "help",
  description: "Show all available commands with descriptions.",
  execute: async ({ api, event }) => {
    try {
      const commandDir = path.join(__dirname);
      const files = fs.readdirSync(commandDir).filter(file => file.endsWith(".js"));

      let helpMessage = `╭───────[ ${config.botName || "ChatBot"} Help ]───────╮\n`;

      for (const file of files) {
        const command = require(path.join(commandDir, file));

        // Skip disabled commands
        if (config.disabledCommands.includes(command.name)) continue;

        // Show alias if available
        const alias = Object.entries(config.commandAliases).find(([key, val]) => val === command.name)?.[0] || null;

        helpMessage += `│ • ${config.prefix}${command.name}`;
        helpMessage += alias ? ` (alias: ${config.prefix}${alias})` : "";
        helpMessage += `\n│   ↳ ${command.description || "No description"}\n`;
      }

      helpMessage += `╰────────────────────────────╯\n`;
      helpMessage += `\nUse "${config.prefix}<command>" to execute a command.`;

      api.sendMessage(helpMessage, event.threadID);
    } catch (err) {
      console.error("Error in help command:", err);
      api.sendMessage(config.messages.error || "Error occurred while showing help.", event.threadID);
    }
  },
};
