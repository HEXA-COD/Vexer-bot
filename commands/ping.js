// commands/ping.js
module.exports = {
  name: "ping",
  description: "Replies with Pong! to test the bot.",
  execute: async ({ api, event }) => {
    try {
      await api.sendMessage("Pong!", event.senderID);
    } catch (err) {
      console.error("Error in ping command:", err);
    }
  },
};
