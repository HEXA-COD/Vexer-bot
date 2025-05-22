const fca = require("fca-unofficial");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

// Load config
const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Error: config.json missing!");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Load appstate
const appStatePath = path.join(__dirname, "appstate.json");
if (!fs.existsSync(appStatePath)) {
  console.error("Error: appstate.json missing!");
  process.exit(1);
}
const appState = JSON.parse(fs.readFileSync(appStatePath, "utf8"));

// Cooldown map
const cooldowns = new Map();

// Load commands dynamically
const commands = new Map();
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.name) {
      commands.set(command.name, command);
      console.log(`Loaded command: ${command.name}`);
    }
  }
} else {
  console.warn("Warning: commands folder missing. No commands loaded.");
}

// Helper: check cooldown
function isOnCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  if (Date.now() > cooldowns.get(userId)) {
    cooldowns.delete(userId);
    return false;
  }
  return true;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now() + (config.cooldownSeconds || 5) * 1000);
}

console.log("Logging in with appstate...");

fca.login({ appState }, (err, api) => {
  if (err) {
    console.error("Login failed:", err);
    return;
  }
  console.log(`Logged in as: ${api.getCurrentUserID()}`);

  api.setOptions({ listenEvents: true });

  api.listenMqtt(async (err, event) => {
    if (err) {
      console.error("Listen error:", err);
      return;
    }

    if (event.type === "message" && event.body) {
      const senderID = event.senderID;
      const message = event.body.trim();

      if (senderID === api.getCurrentUserID()) return; // ignore self messages

      if (!message.startsWith(config.prefix)) return; // ignore non-command messages

      if (isOnCooldown(senderID)) {
        api.sendMessage(
          `Please wait before sending another command.`,
          senderID
        );
        return;
      }

      setCooldown(senderID);

      // Parse command and args
      const args = message.slice(config.prefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();

      if (!commands.has(commandName)) {
        api.sendMessage(`Unknown command: ${commandName}`, senderID);
        return;
      }

      const command = commands.get(commandName);

      try {
        await command.execute({ api, event, args, config, moment });
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        api.sendMessage(
          `An error occurred while executing the command.`,
          senderID
        );
      }
    }
  });
});
