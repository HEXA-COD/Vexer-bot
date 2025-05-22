const fca = require('fca-unofficial');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora').default;
const figlet = require('figlet');
const moment = require('moment-timezone');

const config = require('./config.json');

console.log(chalk.cyan(figlet.textSync(config.botName || "FB Chatbot", { horizontalLayout: "full" })));

const spinner = ora('Starting bot...').start();

function loadAppState(appstatePath) {
  try {
    const appstateRaw = fs.readFileSync(appstatePath, { encoding: 'utf-8' });
    // appstate.txt contains a JSON string representing an array, parse it
    return JSON.parse(appstateRaw);
  } catch (e) {
    spinner.fail('Failed to load appstate from ' + appstatePath);
    console.error(e);
    process.exit(1);
  }
}

const appState = loadAppState(config.appStateFile || 'appstate.txt');

spinner.text = 'Logging in with appstate...';

fca.login({ appState }, (err, api) => {
  if (err) {
    spinner.fail('Login failed: ' + err.message);
    return process.exit(1);
  }
  spinner.succeed('Logged in successfully as: ' + api.getCurrentUserID());

  // Set timezone from config or default
  const timezone = config.timezone || 'UTC';
  moment.tz.setDefault(timezone);

  // Load commands once here to cache
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.warn(chalk.yellow('Commands folder not found. Creating one.'));
    fs.mkdirSync(commandsPath);
  }

  // Set global commands cache (optional, custom.js handles loading)
  global.commands = new Map();
  fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      try {
        const command = require(path.join(commandsPath, file));
        if (command.name) {
          global.commands.set(command.name, command);
          console.log(chalk.green(`Loaded command: ${command.name}`));
        }
      } catch (e) {
        console.error(chalk.red(`Failed to load command ${file}:`), e);
      }
    });

  // Import custom.js for message event handling
  const handleMessage = require('./custom');

  // Listen for messages
  api.listenMqtt((errListen, message) => {
    if (errListen) {
      console.error(chalk.red('Listen error:'), errListen);
      return;
    }

    try {
      handleMessage(api, message, config);
    } catch (error) {
      console.error(chalk.red('Error handling message:'), error);
    }
  });
});
