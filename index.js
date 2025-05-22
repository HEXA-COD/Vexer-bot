// Advanced Facebook Chatbot Entry Point

const login = require("fca-unofficial");
const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const figlet = require("figlet");
const ora = require("ora").default;
const moment = require("moment-timezone");
const Table = require("cli-table3");
const dotenv = require("dotenv");
const winston = require("winston");

dotenv.config();

const config = require("./config.json");
const appState = require("./appstate.json");

const commandsDir = path.join(__dirname, "commands");
const commands = new Map();

// Display banner
console.log(chalk.cyan(figlet.textSync("FB Chatbot", { horizontalLayout: "full" })));
console.log(chalk.greenBright(`Starting Bot as: ${config.botName} | Timezone: ${config.timezone}`));
console.log(chalk.gray(`Version: ${config.version || "1.0.0"} | Prefix: ${config.prefix}\n`));

// Logger setup
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: "bot.log" }),
    new winston.transports.Console()
  ]
});

// Spinner while logging in
const spinner = ora("Logging in with appstate...").start();

login({ appState }, (err, api) => {
  if (err) {
    spinner.fail("Failed to login.");
    return console.error(chalk.red("Login Error:"), err);
  }

  spinner.succeed("Logged in successfully!");
  logger.info("Bot logged in using appstate.json");

  api.setOptions({
    listenEvents: true,
    selfListen: config.selfListen || false,
    logLevel: "silent"
  });

  // Load Commands
  fs.readdirSync(commandsDir).forEach(file => {
    if (file.endsWith(".js")) {
      const command = require(`./commands/${file}`);
      if (command.name) {
        commands.set(command.name, command);
        console.log(chalk.yellow(`Loaded command: ${command.name}`));
      }
    }
  });

  // Display command table
  const table = new Table({ head: ["Command", "Description"], colWidths: [20, 50] });
  commands.forEach(cmd => table.push([cmd.name, cmd.description || "No description"]));
  console.log(table.toString());

  // Listen to messages
  api.listenMqtt((err, message) => {
    if (err) return logger.error("Listen error:", err);

    if (message.body && message.body.startsWith(config.prefix)) {
      const args = message.body.slice(config.prefix.length).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();

      const command = commands.get(cmdName);
      if (command) {
        logger.info(`Executing command: ${cmdName} by ${message.senderID}`);
        command.run({ api, message, args, config });
      }
    }
  });
});
