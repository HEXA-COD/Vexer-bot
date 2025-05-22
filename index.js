process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
});
const fs = require("fs");
const path = require("path");
const login = require("ws3-fca");
const config = require("./config.json");

const commands = new Map();
const cooldowns = new Map();

// Load AppState
let appState;
try {
  appState = JSON.parse(fs.readFileSync(config.APPSTATE_PATH, "utf-8"));
} catch (err) {
  console.error("❌ Failed to read AppState:", err.message);
  process.exit(1);
}

// Login to Facebook
login({ appState }, async (err, api) => {
  if (err) {
    console.error("❌ Login error:", err);
    return;
  }

  api.setOptions({
    listenEvents: config.listenEvents,
    selfListen: config.selfListen,
    forceLogin: config.forceLogin,
    autoMarkDelivery: config.autoMarkDelivery,
    autoReconnect: config.autoReconnect,
    logLevel: config.logLevel || "silent"
  });

  // Log bot info
  const userInfo = await new Promise(resolve => {
    api.getUserInfo(api.getCurrentUserID(), (err, data) => {
      resolve(data ? data[api.getCurrentUserID()] : {});
    });
  });

  console.log(`${config.onlineMessage || "🤖 Bot is online!"}`);
  console.log(`Logged in as: ${userInfo.name || "Unknown"} (${api.getCurrentUserID()})`);
  console.log(`Using prefix: "${config.prefix}"`);

  // Load Commands
  fs.readdirSync(config.commandPath).filter(file => file.endsWith(".js")).forEach(file => {
    const command = require(path.join(__dirname, config.commandPath, file));
    if (command.name) commands.set(command.name, command);
  });

  // Load Events
  fs.readdirSync(config.eventPath).filter(file => file.endsWith(".js")).forEach(file => {
    const event = require(path.join(__dirname, config.eventPath, file));
    if (event.name && typeof event.run === "function") {
      api.listenMqtt((err, eventData) => {
        if (err) return console.error("Listener error:", err);
        if (eventData.type === event.name) event.run(api, eventData);
      });
    }
  });

  // Start listener
  api.listenMqtt(async (err, event) => {
    if (err) return console.error("Listener error:", err);
    if (event.type !== "message" || !event.body) return;

    const body = event.body.trim();
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const commandName = config.commandAliases[cmdName] || cmdName;

    const command = commands.get(commandName);
    if (!command) {
      return api.sendMessage(config.messages.unknownCommand || "Unknown command.", event.threadID);
    }

    const now = Date.now();
    if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Map());
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (config.cooldownSeconds || 5) * 1000;

    if (timestamps.has(event.senderID)) {
      const expiration = timestamps.get(event.senderID) + cooldownAmount;
      if (now < expiration) {
        const remaining = ((expiration - now) / 1000).toFixed(1);
        return api.sendMessage(config.messages.cooldown.replace("{time}", remaining) || `Please wait ${remaining}s`, event.threadID);
      }
    }

    timestamps.set(event.senderID, now);
    setTimeout(() => timestamps.delete(event.senderID), cooldownAmount);

    try {
      command.run({ api, event, args, config });
    } catch (err) {
      console.error(`❌ Error in command '${command.name}':`, err);
      api.sendMessage(config.messages.error || "An error occurred.", event.threadID);
    }
  });
});
