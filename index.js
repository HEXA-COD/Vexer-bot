const login  = require("fca-unofficial");
const config = require("./config.json");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const chalk = require("chalk");
const figlet = require("figlet");

// Load appState (make sure it's JSON)
const appState = require("./appState.json");

// In-memory cooldown tracker: { senderID_commandName: timestamp }
const cooldowns = new Map();

// Logging helper
const log = (msg) => {
  if (config.enableLogging) {
    const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(config.logFile, logMsg, "utf8");
  }
};

const startBot = () => {
  console.log(chalk.cyan(figlet.textSync(config.botName, { horizontalLayout: "full" })));
  console.log(`Starting bot with prefix '${config.prefix}' and ownerID '${config.ownerID}'`);
  
  login({ appState }, (err, api) => {
    if (err) {
      console.error("❌ Login failed:", err);
      log(`Login failed: ${err}`);
      return;
    }

    console.clear();
    console.log(`🤖 Bot '${config.botName}' is now online!`);
    log(`Bot started successfully`);

    // Send welcome message to owner on startup
    api.sendMessage(config.welcomeMessage, config.ownerID);

    api.setOptions({ listenEvents: true, selfListen: false });

    api.listen((err, message) => {
      if (err) {
        console.error("Listener error:", err);
        log(`Listener error: ${err}`);
        return;
      }
      handleMessage(message, api);
    });
  });
};

const handleMessage = (message, api) => {
  const { senderID, body, threadID, messageID } = message;

  // Block messages from blocked users
  if (config.blockedUsers.includes(senderID)) return;

  // Allow only from allowed groups if configured
  if (config.allowedGroups.length > 0 && !config.allowedGroups.includes(threadID)) return;

  // Ignore if no message body or too long
  if (!body || body.length > config.maxMessageLength) return;

  // Check prefix
  if (!body.startsWith(config.prefix)) return;

  // Extract command and args
  let commandText = body.slice(config.prefix.length).trim().split(/\s+/)[0].toLowerCase();
  let args = body.slice(config.prefix.length + commandText.length).trim();

  // Map alias to real command
  if (config.commandAliases[commandText]) {
    commandText = config.commandAliases[commandText];
  }

  // Check disabled commands
  if (config.disabledCommands.includes(commandText)) {
    api.sendMessage(config.messages.unknownCommand, threadID);
    return;
  }

  // Cooldown check
  const cooldownKey = `${senderID}_${commandText}`;
  const now = Date.now();
  if (cooldowns.has(cooldownKey)) {
    const lastUsed = cooldowns.get(cooldownKey);
    const diffSec = (now - lastUsed) / 1000;
    if (diffSec < config.cooldownSeconds) {
      api.sendMessage(config.messages.cooldown, threadID);
      return;
    }
  }
  cooldowns.set(cooldownKey, now);

  // Load command from commands folder
  const commandPath = path.join(__dirname, "commands", `${commandText}.js`);
  if (!fs.existsSync(commandPath)) {
    api.sendMessage(config.messages.unknownCommand, threadID);
    return;
  }

  try {
    const command = require(commandPath);
    // Send typing indicator
    api.sendTypingIndicator(threadID, true);

    setTimeout(() => {
      // Execute command
      command.execute({ message, args, api, config });
      api.sendTypingIndicator(threadID, false);
    }, config.autoTypingDelay);

    log(`Command '${commandText}' executed by ${senderID} in thread ${threadID}`);
  } catch (err) {
    api.sendMessage(config.messages.error, threadID);
    console.error("Command execution error:", err);
    log(`Error in command '${commandText}': ${err}`);
  }
};

// Start the bot
startBot();
