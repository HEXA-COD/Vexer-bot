const fca = require('fca-unofficial');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora').default;
const moment = require('moment-timezone');

// Load config
const config = require('./config.json');

// Load appState (from appstate.txt)
const appState = JSON.parse(fs.readFileSync(path.join(__dirname, 'appstate.txt'), 'utf8'));

// Command prefix and container
const prefix = config.prefix || '!';
const commands = new Map();

// Load commands from commands folder
const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).forEach(file => {
  if (!file.endsWith('.js')) return;
  const command = require(path.join(commandsPath, file));
  commands.set(command.name, command);
  console.log(chalk.green(`Loaded command: ${command.name}`));
});

// Show startup banner
console.log(chalk.cyan(figlet.textSync('FB Chatbot', { horizontalLayout: 'full' })));
console.log(chalk.yellow(`Version: ${config.version} | Prefix: ${prefix}`));
console.log(chalk.yellow(`Starting Bot as: ${config.botName} | Timezone: ${config.timezone}`));

const spinner = ora('Logging in with appstate...').start();

(async () => {
  try {
    // Login with appstate using new fca-unofficial style
    const api = await fca.create({ appState });

    spinner.succeed('Logged in successfully!');
    console.log(chalk.green(`Logged in as user ID: ${api.getCurrentUserID()}`));

    // Listen to new messages
    api.listenMqtt(async (err, message) => {
      if (err) {
        console.error(chalk.red('Listen error:'), err);
        return;
      }

      if (!message.body || !message.senderID) return;

      // Ignore own messages
      if (message.senderID === api.getCurrentUserID()) return;

      // Check if message starts with prefix
      if (!message.body.startsWith(prefix)) return;

      // Parse command and args
      const args = message.body.slice(prefix.length).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();

      // Find command
      if (!commands.has(cmdName)) return;

      try {
        await commands.get(cmdName).execute(api, message, args, config);
      } catch (error) {
        console.error(chalk.red(`Error executing command ${cmdName}:`), error);
      }
    });

  } catch (error) {
    spinner.fail('Login failed!');
    console.error(chalk.red('Error during login:'), error);
    process.exit(1);
  }
})();
