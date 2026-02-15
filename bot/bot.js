// bot.js
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { generateWallet, importWallet } from "./wallet.js";
import { saveWallet, getWallet, deleteWallet } from "./db.js";

dotenv.config({ path: "../.env" });

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
console.log("✅ Bot running...");

// /start
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id.toString();
  const existingWallet = await getWallet(userId);
  if (existingWallet) {
    bot.sendMessage(userId, `✅ You already have a wallet:\n${existingWallet.address}`);
    return;
  }

  const wallet = generateWallet();
  if (!wallet) {
    bot.sendMessage(userId, "❌ Error creating wallet");
    return;
  }

  await saveWallet(userId, wallet);
  bot.sendMessage(
    userId,
    `🚀 Wallet Created\n\nSend STX to:\n${wallet.address}\n\nCost per AI request: ${process.env.AI_PAYMENT_AMOUNT} STX\n\nAfter funding, use:\n/ask Your question`
  );
});

// /export
bot.onText(/\/export/, async (msg) => {
  const userId = msg.from.id.toString();
  const wallet = await getWallet(userId);
  if (!wallet) return bot.sendMessage(userId, "❌ No wallet found. Type /start");
  bot.sendMessage(userId, `🔑 Your private key:\n${wallet.privateKey}`);
});

// /import <privateKey>
bot.onText(/\/import (.+)/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const privateKey = match[1].trim();

  const wallet = importWallet(privateKey);
  if (!wallet) return bot.sendMessage(userId, "❌ Invalid private key");

  await saveWallet(userId, wallet);
  bot.sendMessage(userId, `✅ Wallet imported\nAddress: ${wallet.address}`);
});

// /reset
bot.onText(/\/reset/, async (msg) => {
  const userId = msg.from.id.toString();
  await deleteWallet(userId);
  bot.sendMessage(userId, "🗑️ Wallet reset. Type /start to create a new wallet.");
});

// /balance
bot.onText(/\/balance/, async (msg) => {
  const userId = msg.from.id.toString();
  const wallet = await getWallet(userId);
  if (!wallet) return bot.sendMessage(userId, "❌ No wallet found. Type /start");

  const balance = "_fetch via API_"; // TODO: integrate real STX API
  bot.sendMessage(userId, `💰 Wallet:\n${wallet.address}\nBalance: ${balance}`);
});

// /ask <question>
bot.onText(/\/ask (.+)/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const question = match[1];

  const wallet = await getWallet(userId);
  if (!wallet) return bot.sendMessage(userId, "❌ No wallet found. Type /start");

  bot.sendMessage(userId, `🤖 Your question: ${question}\n_Response will be here_`);
});
