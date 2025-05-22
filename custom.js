const fs = require('fs');
const path = require('path');

module.exports = function (api, event, config) {
  if (!event.body || !event.threadID || event.senderID === api.getCurrentUserID()) return;

  const prefix = config.prefix || '!';
  const message = event.body.trim();

  if (!message.startsWith(prefix)) return;

  const args = message.slice(prefix.length).split(/\s+/);
  const commandName = args.shift().toLowerCase();

  // Load commands once and cache
  if (!global.commands) {
    global.commands = new Map();

    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const command = require(path.join(commandsPath, file));
        if (command.name) {
          global.commands.set(command.name, command);
          console.log(`Loaded command: ${command.name}`);
        }
      } catch (e) {
        console.error(`Failed to load command ${file}:`, e);
      }
    }
  }

  const command = global.commands.get(commandName);
  if (!command) return;

  // Cooldown check (basic)
  if (!global.cooldowns) global.cooldowns = new Map();
  const now = Date.now();
  const cooldownAmount = (command.cooldown || 3) * 1000;
  const userCooldownKey = `${event.senderID}_${commandName}`;

  if (global.cooldowns.has(userCooldownKey)) {
    const expirationTime = global.cooldowns.get(userCooldownKey) + cooldownAmount;
    if (now < expirationTime) {
      const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
      return api.sendMessage(`Please wait ${timeLeft}s before using !${commandName} again.`, event.threadID);
    }
  }

  global.cooldowns.set(userCooldownKey, now);

  // Run command
  try {
    command.run({ api, event, args, config });
  } catch (error) {
    console.error(`Error running command ${commandName}:`, error);
    api.sendMessage(`Oops, something went wrong while executing !${commandName}.`, event.threadID);
  }
};
