// ====== ENV & MODULES ======
import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import { 
  generateKeypair, 
  privateKeyToAccount,
  STXtoMicroSTX,
  paymentMiddleware,
  getPayment,
  wrapAxiosWithPayment,
  decodePaymentResponse
} from 'x402-stacks';

// ====== ENV CONFIG ======
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
const MONGO_URI = process.env.MONGO_URI;
const NETWORK = process.env.NETWORK || 'mainnet';
const AI_PAYMENT_AMOUNT = parseFloat(process.env.AI_PAYMENT_AMOUNT || '0.03');
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.stacksx402.com';
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

// ====== EXPRESS APP ======
const app = express();
app.use(bodyParser.json());
app.get('/', (req, res) => res.send('x402 AI Backend Running 🚀'));
app.get('/health', (req, res) => res.json({ status: 'ok', network: NETWORK }));

// ====== MONGODB ======
let dbClient;
let db;
let isDbConnected = false;

async function initMongo() {
  try {
    dbClient = new MongoClient(MONGO_URI);
    await dbClient.connect();
    db = dbClient.db();
    isDbConnected = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Bot will continue but wallet features require database');
  }
}

// ====== BOT WALLET ======
const botAccount = privateKeyToAccount(BOT_PRIVATE_KEY, NETWORK);
const BOT_ADDRESS = botAccount.address;
console.log('Bot STX Address:', BOT_ADDRESS);
console.log('Network:', NETWORK);

// ====== HELPERS ======
async function getUserWallet(chatId) {
  if (!isDbConnected || !db) {
    console.error('Database not connected');
    return null;
  }
  try {
    return await db.collection('wallets').findOne({ chatId });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }
}

async function saveUserWallet(chatId, walletData) {
  if (!isDbConnected || !db) {
    throw new Error('Database not connected');
  }
  return db.collection('wallets').updateOne(
    { chatId }, 
    { $set: walletData }, 
    { upsert: true }
  );
}

// ====== AI ENDPOINT (Protected by x402-stacks) ======
app.post(
  '/api/ai-query',
  paymentMiddleware({
    amount: STXtoMicroSTX(AI_PAYMENT_AMOUNT),
    payTo: BOT_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
    description: 'AI Query via Telegram Bot',
  }),
  async (req, res) => {
    const payment = getPayment(req);
    const { question, chatId } = req.body;

    const aiResponse = `🤖 *AI Response*\n\n` +
      `Question: "${question}"\n\n` +
      `Answer: AI (Artificial Intelligence) is the simulation of human intelligence by machines, ` +
      `especially computer systems. It includes learning, reasoning, and self-correction.\n\n` +
      `✅ Payment confirmed: ${AI_PAYMENT_AMOUNT} STX\n` +
      `🎟️ NFT minted as receipt!\n` +
      `📝 Transaction: ${payment?.transaction}`;

    // Store the response if DB is connected
    if (isDbConnected && db) {
      try {
        await db.collection('responses').insertOne({
          chatId,
          question,
          response: aiResponse,
          payment: {
            transaction: payment?.transaction,
            payer: payment?.payer,
            amount: AI_PAYMENT_AMOUNT,
          },
          nftMinted: true,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error saving response:', error);
      }
    }

    res.json({
      success: true,
      answer: aiResponse,
      payment: {
        transaction: payment?.transaction,
        payer: payment?.payer,
        network: payment?.network,
      },
    });
  }
);

// ====== FUNCTION TO MAKE PAID REQUEST ======
async function makeAIPaidRequest(userPrivateKey, question, chatId) {
  try {
    const userAccount = privateKeyToAccount(userPrivateKey, NETWORK);
    
    const api = wrapAxiosWithPayment(
      axios.create({
        baseURL: BACKEND_URL,
        timeout: 60000,
      }),
      userAccount
    );

    console.log(`Making paid request for user: ${userAccount.address}`);
    
    const response = await api.post('/api/ai-query', {
      question,
      chatId,
    });

    const paymentResponse = decodePaymentResponse(
      response.headers['payment-response']
    );

    return {
      success: true,
      answer: response.data.answer,
      payment: paymentResponse,
    };

  } catch (error) {
    console.error('Payment request error:', error.response?.data || error.message);
    throw error;
  }
}

// ====== TELEGRAM BOT - Initialize after DB ======
let bot;

async function initBot() {
  // Wait for MongoDB
  await initMongo();
  
  // Initialize bot
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  
  // ====== BOT COMMANDS ======

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isDbConnected) {
      return bot.sendMessage(chatId, 
        '⚠️ Database temporarily unavailable. Please try again in a moment.'
      );
    }
    
    let wallet = await getUserWallet(chatId);

    if (!wallet) {
      try {
        const keypair = generateKeypair(NETWORK);
        wallet = {
          chatId,
          address: keypair.address,
          privateKey: keypair.privateKey,
          createdAt: new Date(),
        };
        await saveUserWallet(chatId, wallet);
        
        bot.sendMessage(chatId, 
          `✅ *Welcome to x402 AI Bot!*\n\n` +
          `Your Stacks wallet has been generated:\n` +
          `📍 Address: \`${keypair.address}\`\n\n` +
          `⚠️ *IMPORTANT: Fund this wallet with STX!*\n` +
          `💰 Minimum: ${AI_PAYMENT_AMOUNT} STX per query\n` +
          `🌐 Network: ${NETWORK}\n\n` +
          `*How to fund:*\n` +
          `1. Copy your address above\n` +
          `2. Send STX from any wallet\n` +
          `3. Use /balance to check\n\n` +
          `*Commands:*\n` +
          `/info - Learn more\n` +
          `/balance - Check STX\n` +
          `/ask <question> - Ask AI\n` +
          `/export - Get private key`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error creating wallet:', error);
        bot.sendMessage(chatId, '❌ Error creating wallet. Please try /start again.');
      }
    } else {
      bot.sendMessage(chatId, 
        `Welcome back! 👋\n\n` +
        `Your wallet: \`${wallet.address}\`\n\n` +
        `Use /ask <your question> to query AI\n` +
        `Cost: ${AI_PAYMENT_AMOUNT} STX per query`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  bot.onText(/\/info/, (msg) => {
    bot.sendMessage(msg.chat.id, 
      `🤖 *x402 AI Telegram Bot*\n\n` +
      `This bot uses the x402-stacks payment protocol for blockchain-powered AI queries.\n\n` +
      `*How it works:*\n` +
      `1️⃣ You get a Stacks wallet (/start)\n` +
      `2️⃣ Fund it with STX\n` +
      `3️⃣ Ask questions (/ask)\n` +
      `4️⃣ Payment auto-deducted via x402\n` +
      `5️⃣ Receive AI response + NFT receipt\n\n` +
      `*Pricing:*\n` +
      `💰 ${AI_PAYMENT_AMOUNT} STX per query\n` +
      `🎟️ Free NFT receipt with each payment\n\n` +
      `*Network:* ${NETWORK}\n` +
      `*Bot Wallet:* \`${BOT_ADDRESS}\`\n\n` +
      `*Commands:*\n` +
      `/start - Get wallet\n` +
      `/balance - Check balance\n` +
      `/ask <question> - Ask AI\n` +
      `/export - Export key\n` +
      `/import <key> - Import wallet`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/balance/, async (msg) => {
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) return bot.sendMessage(msg.chat.id, '❌ Use /start first');

    try {
      const apiUrl = 'https://api.hiro.so';
      const url = `${apiUrl}/extended/v1/address/${wallet.address}/balances`;
      
      const resp = await fetch(url);
      const data = await resp.json();
      const balanceSTX = parseFloat(data.stx.balance) / 1_000_000;
      
      const explorerUrl = `https://explorer.hiro.so/address/${wallet.address}?chain=mainnet`;
      
      bot.sendMessage(msg.chat.id, 
        `💰 *Your Balance*\n\n` +
        `Address: \`${wallet.address}\`\n` +
        `Balance: *${balanceSTX.toFixed(6)} STX*\n\n` +
        `Cost per query: ${AI_PAYMENT_AMOUNT} STX\n` +
        `Available queries: ~${Math.floor(balanceSTX / AI_PAYMENT_AMOUNT)}\n\n` +
        `[View on Explorer](${explorerUrl})`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Balance error:', err);
      bot.sendMessage(msg.chat.id, 
        `❌ Error fetching balance\n\n` +
        `Wallet: \`${wallet.address}\`\n\n` +
        `[Check manually on Explorer](https://explorer.hiro.so/address/${wallet.address}?chain=mainnet)`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  bot.onText(/\/export/, async (msg) => {
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) return bot.sendMessage(msg.chat.id, '❌ Use /start first');
    bot.sendMessage(msg.chat.id, 
      `🔑 *Your Private Key*\n\n` +
      `\`${wallet.privateKey}\`\n\n` +
      `⚠️ *KEEP THIS SECRET!*\n` +
      `Never share this key with anyone.\n` +
      `Anyone with this key can access your funds.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/import (.+)/, async (msg, match) => {
    if (!isDbConnected) {
      return bot.sendMessage(msg.chat.id, '⚠️ Database unavailable. Try again later.');
    }
    
    try {
      const account = privateKeyToAccount(match[1].trim(), NETWORK);
      await saveUserWallet(msg.chat.id, {
        chatId: msg.chat.id,
        address: account.address,
        privateKey: match[1].trim(),
        importedAt: new Date(),
      });
      bot.sendMessage(msg.chat.id, 
        `✅ *Wallet Imported!*\n\n` +
        `Address: \`${account.address}\`\n\n` +
        `Use /balance to check your funds`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      bot.sendMessage(msg.chat.id, '❌ Invalid private key. Please check and try again.');
    }
  });

  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const question = match[1];
    const wallet = await getUserWallet(chatId);
    
    if (!wallet) return bot.sendMessage(chatId, '❌ Use /start first to get a wallet');
    
    const processingMsg = await bot.sendMessage(chatId, 
      `🔍 *Processing your question...*\n\n` +
      `"${question}"\n\n` +
      `💸 Deducting ${AI_PAYMENT_AMOUNT} STX...\n` +
      `⏳ Please wait...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await makeAIPaidRequest(wallet.privateKey, question, chatId);
      
      const txUrl = `https://explorer.hiro.so/txid/${result.payment.transaction}?chain=mainnet`;
      
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      
      bot.sendMessage(chatId, 
        `${result.answer}\n\n` +
        `🔗 [View Transaction](${txUrl})`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      
      if (error.response?.status === 402) {
        bot.sendMessage(chatId, 
          `❌ *Payment Required*\n\n` +
          `Could not process payment. Please check:\n` +
          `1. Your wallet has sufficient balance (${AI_PAYMENT_AMOUNT} STX needed)\n` +
          `2. Use /balance to verify funds\n\n` +
          `Need to fund your wallet?\n` +
          `Address: \`${wallet.address}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId, 
          `❌ *Error Processing Request*\n\n` +
          `${error.message}\n\n` +
          `Please try again or contact support.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  });

  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    if (!msg.text) return;
    
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) return bot.sendMessage(msg.chat.id, '❌ Use /start first');
    
    bot.sendMessage(msg.chat.id, 
      `💡 *Tip:* Use the /ask command\n\n` +
      `Example:\n` +
      `/ask What is blockchain?\n\n` +
      `Your message: "${msg.text}"\n\n` +
      `Try: \`/ask ${msg.text}\``,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('polling_error', (error) => console.error('Telegram error:', error));
  
  console.log('✅ Bot ready! Try it: https://t.me/X402AI_BOT');
}

// ====== START SERVER ======
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Network: ${NETWORK}`);
  console.log(`💰 Bot address: ${BOT_ADDRESS}`);
  console.log(`💸 Payment amount: ${AI_PAYMENT_AMOUNT} STX`);
  console.log(`🔗 Backend URL: ${BACKEND_URL}`);
  
  // Initialize bot after server starts
  await initBot();
});