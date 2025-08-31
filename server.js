import mineflayer from "mineflayer";
import { Bot } from "./bot/bot.js";
import express from 'express';
const app = express();
const port = 3000;
// Mineflayer bot setup
let bot = null;
let reconnectTimeout = null;
let isBanned = false;
function createBot() {
  if (isBanned) {
    console.log('Bot is banned, halting reconnect attempts until manually resolved.');
    return;
  }
  // Clear existing bot instance and timeout
  if (bot) {
    bot.quit();
    bot = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  bot = mineflayer.createBot({
    host: "AojihaAdase.aternos.me",
    username: "aperbot",
    version: "1.8.9",
  });
  // Start the custom Bot logic
  new Bot(bot).start();
  // Log chat messages and detect bans
  bot.on("message", (msg) => {
    const message = msg.toString();
    console.log(message);
    if (message.includes("You have been banned") || message.includes("banned for")) {
      console.log('Ban detected! Pausing reconnect attempts.');
      isBanned = true;
      bot.quit();
      bot = null;
      console.log('Please unban "aperbot" via Aternos dashboard or /pardon command.');
    }
  });
 
  // Handle kick events
  bot.on('kicked', (reason) => {
    console.log(`Kicked from server: ${reason}`);
    if (reason.includes("banned") || reason.includes("You have been idle")) {
      console.log('Ban detected for idling or ToS violation.');
      isBanned = true;
      console.log('Please unban "aperbot" via Aternos dashboard or /pardon command.');
    } else if (reason.includes("Connection throttled")) {
      console.log('Connection throttled, increasing delay...');
      currentReconnectDelay += 10000; // Add 10 seconds to avoid throttling
    } else if (reason.includes("duplicate_login")) {
      console.log('Duplicate login detected, ensuring session cleanup...');
    }
    if (!isBanned) attemptReconnect();
  });
  // Handle errors (including ECONNRESET)
  bot.on('error', (err) => {
    console.log(`Bot error: ${err}`);
    if (err.code === 'ECONNRESET') {
      console.log('Connection reset, attempting to reconnect...');
    }
    if (!isBanned) attemptReconnect();
  });
  // Handle bot end (disconnection)
  bot.on('end', () => {
    console.log('Bot disconnected, attempting to reconnect...');
    if (!isBanned) attemptReconnect();
  });
  // Handle successful login
  bot.on('login', () => {
    console.log('Bot successfully logged in!');
    reconnectAttempts = 0; // Reset reconnect attempts
    currentReconnectDelay = initialReconnectDelay; // Reset delay
    isBanned = false; // Clear ban flag
  });
  // Anti-idle loop: wait 2 min, go forward (200ms), wait 2 min, go back (200ms), repeat
  function startAntiIdleLoop() {
    if (bot && bot.isConnected && !isBanned) {
      // Wait 2 minutes (120000 ms), then move forward
      setTimeout(() => {
        if (bot && bot.isConnected && !isBanned) {
          bot.setControlState('forward', true);
          setTimeout(() => {
            if (bot) bot.setControlState('forward', false);
          }, 200);
          // After forward, wait another 2 minutes, then move back
          setTimeout(() => {
            if (bot && bot.isConnected && !isBanned) {
              bot.setControlState('back', true);
              setTimeout(() => {
                if (bot) bot.setControlState('back', false);
              }, 200);
            }
            // Restart the loop after back movement
            startAntiIdleLoop();
          }, 120000);
        } else {
          // If conditions not met, restart loop to check again
          startAntiIdleLoop();
        }
      }, 120000);
    } else {
      // If not connected or banned, check again after a short delay
      setTimeout(startAntiIdleLoop, 10000);
    }
  }
  // Start the anti-idle loop
  startAntiIdleLoop();
  return bot;
}
// Reconnection logic
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const initialReconnectDelay = 60000; // 60 seconds
let currentReconnectDelay = initialReconnectDelay;
function attemptReconnect() {
  if (isBanned) {
    console.log('Reconnect skipped due to ban. Resolve ban manually.');
    return;
  }
  if (bot) {
    bot.quit();
    bot = null;
  }
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${currentReconnectDelay / 1000} seconds...`);
    reconnectTimeout = setTimeout(() => {
      console.log('Reconnecting...');
      createBot();
      currentReconnectDelay += 10000; // Add 10 seconds per attempt
    }, currentReconnectDelay);
  } else {
    console.log('Max reconnect attempts reached. Waiting 15 minutes before retrying...');
    reconnectTimeout = setTimeout(() => {
      console.log('Resetting reconnect attempts and trying again...');
      reconnectAttempts = 0;
      currentReconnectDelay = initialReconnectDelay;
      createBot();
    }, 900000); // Wait 15 minutes
  }
}
// Initialize the bot
createBot();
// Express server setup
app.get('/', (req, res) => {
  res.sendStatus(200);
});
app.listen(port, () => {
  console.log(`Sunucu ${port} numaralı bağlantı noktasında yürütülüyor.`);
});
