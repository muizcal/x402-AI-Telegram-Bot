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

const PORT = process.env.PORT || 8080;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
const MONGO_URI = process.env.MONGO_URI;
const NETWORK = process.env.NETWORK || 'mainnet';
const AI_PAYMENT_AMOUNT = parseFloat(process.env.AI_PAYMENT_AMOUNT || '0.03');
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.stacksx402.com';
const BACKEND_URL = process.env.BACKEND_URL;

const app = express();
app.use(bodyParser.json());
app.get('/', (req, res) => res.send('x402 AI Backend Running 🚀'));
app.get('/health', (req, res) => res.json({ status: 'ok', network: NETWORK }));

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

const botAccount = privateKeyToAccount(BOT_PRIVATE_KEY, NETWORK);
const BOT_ADDRESS = botAccount.address;
console.log('Bot STX Address:', BOT_ADDRESS);
console.log('Network:', NETWORK);

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

    const questionLower = question.toLowerCase();
    
    let aiAnswer;
    if (questionLower.includes('blockchain')) {
      aiAnswer = 'Blockchain is a distributed, immutable ledger that records transactions across a network of computers. It\'s the technology behind cryptocurrencies like Bitcoin and Stacks.';
    } else if (questionLower.includes('x402')) {
      aiAnswer = 'x402 is a payment protocol that uses HTTP 402 status code for micropayments. It enables services to charge for access using cryptocurrency, perfect for AI agents and pay-per-use models.';
    } else if (questionLower.includes('stacks')) {
      aiAnswer = 'Stacks is a Bitcoin layer-2 blockchain that enables smart contracts and decentralized apps while settling on Bitcoin. It uses STX as its native cryptocurrency.';
    } else if (questionLower.includes('bitcoin')) {
      aiAnswer = 'Bitcoin is the first and most well-known cryptocurrency, created in 2009. It\'s a decentralized digital currency without a central bank or administrator.';
    } else if (questionLower.includes('ai') || questionLower.includes('artificial intelligence')) {
      aiAnswer = 'AI (Artificial Intelligence) is the simulation of human intelligence by machines, especially computer systems. It includes learning, reasoning, and self-correction.';
    } else if (questionLower.includes('nft')) {
      aiAnswer = 'NFT (Non-Fungible Token) is a unique digital asset that represents ownership of a specific item or piece of content on the blockchain.';
    } else if (questionLower.includes('crypto') || questionLower.includes('cryptocurrency')) {
      aiAnswer = 'Cryptocurrency is a digital or virtual currency that uses cryptography for security. It operates independently of a central bank.';
    } else if (questionLower.includes('payment') || questionLower.includes('pay')) {
      aiAnswer = 'This bot uses micropayments via the x402-stacks protocol, allowing you to pay small amounts (0.03 STX) per AI query using cryptocurrency.';
    } else {
      aiAnswer = 'That\'s an interesting question! This bot demonstrates blockchain-powered micropayments for AI services. Each query costs 0.03 STX and is recorded on-chain. Ask me about blockchain, AI, x402, Stacks, or cryptocurrency!';
    }

    const aiResponse = `🤖 *AI Response*\n\n` +
      `Question: "${question}"\n\n` +
      `Answer: ${aiAnswer}\n\n` +
      `✅ Payment confirmed: ${AI_PAYMENT_AMOUNT} STX\n` +
      `📝 Transaction: ${payment?.transaction}\n\n` +
      `🔗 Powered by x402-stacks payment protocol`;

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

let bot;

async function initBot() {
  await initMongo();
  
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  

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
          `💰 Cost: ${AI_PAYMENT_AMOUNT} STX per query\n` +
          `🌐 Network: ${NETWORK}\n\n` +
          `*How to fund your wallet:*\n` +
          `1. Copy your address above\n` +
          `2. Send STX from any Stacks wallet\n` +
          `3. Use /balance to check funds\n\n` +
          `*Commands:*\n` +
          `/info - Learn about the bot\n` +
          `/balance - Check STX balance\n` +
          `/ask <question> - Ask AI (costs ${AI_PAYMENT_AMOUNT} STX)\n` +
          `/export - Export private key\n` +
          `/import <key> - Import existing wallet`,
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
      `This bot demonstrates the x402-stacks payment protocol - enabling micropayments for AI services using blockchain.\n\n` +
      `*How it works:*\n` +
      `1️⃣ Get a Stacks wallet (/start)\n` +
      `2️⃣ Fund it with STX cryptocurrency\n` +
      `3️⃣ Ask questions (/ask)\n` +
      `4️⃣ Payment auto-deducted via HTTP 402 protocol\n` +
      `5️⃣ Receive AI response with transaction proof\n\n` +
      `*Key Features:*\n` +
      `💰 Micropayments: ${AI_PAYMENT_AMOUNT} STX per query\n` +
      `⚡ Instant: Payments in seconds\n` +
      `🔗 Transparent: All transactions on-chain\n` +
      `🤖 AI-Agent Ready: Programmatic payments\n\n` +
      `*Technical Details:*\n` +
      `Network: ${NETWORK}\n` +
      `Protocol: x402-stacks V2\n` +
      `Bot Wallet: \`${BOT_ADDRESS}\`\n\n` +
      `*Commands:*\n` +
      `/start - Generate wallet\n` +
      `/balance - Check balance\n` +
      `/ask <question> - Ask AI\n` +
      `/export - Export key\n` +
      `/import <key> - Import wallet\n\n` +
      `🔗 Learn more: https://docs.stacksx402.com`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/balance/, async (msg) => {
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) return bot.sendMessage(msg.chat.id, '❌ Use /start first to create a wallet');

    try {
      const apiUrl = 'https://api.hiro.so';
      const url = `${apiUrl}/extended/v1/address/${wallet.address}/balances`;
      
      const resp = await fetch(url);
      const data = await resp.json();
      const balanceSTX = parseFloat(data.stx.balance) / 1_000_000;
      
      const explorerUrl = `https://explorer.hiro.so/address/${wallet.address}?chain=${NETWORK}`;
      
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
        `[Check manually on Explorer](https://explorer.hiro.so/address/${wallet.address}?chain=${NETWORK})`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  bot.onText(/\/export/, async (msg) => {
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) return bot.sendMessage(msg.chat.id, '❌ Use /start first to create a wallet');
    
    bot.sendMessage(msg.chat.id, 
      `🔑 *Your Private Key*\n\n` +
      `\`${wallet.privateKey}\`\n\n` +
      `⚠️ *KEEP THIS SECRET!*\n\n` +
      `Never share this key with anyone.\n` +
      `Anyone with this key can access your funds.\n\n` +
      `Use this to import your wallet elsewhere or recover access.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/import (.+)/, async (msg, match) => {
    if (!isDbConnected) {
      return bot.sendMessage(msg.chat.id, '⚠️ Database unavailable. Try again later.');
    }
    
    try {
      const privateKey = match[1].trim();
      const account = privateKeyToAccount(privateKey, NETWORK);
      
      await saveUserWallet(msg.chat.id, {
        chatId: msg.chat.id,
        address: account.address,
        privateKey: privateKey,
        importedAt: new Date(),
      });
      
      bot.sendMessage(msg.chat.id, 
        ` *Wallet Imported Successfully!*\n\n` +
        `Address: \`${account.address}\`\n\n` +
        `Use /balance to check your funds`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Import error:', err);
      bot.sendMessage(msg.chat.id, 
        `❌ Invalid private key\n\n` +
        `Please check the key and try again.\n` +
        `Format: 64 character hex string`
      );
    }
  });

  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const question = match[1];
    const wallet = await getUserWallet(chatId);
    
    if (!wallet) {
      return bot.sendMessage(chatId, 
        `❌ No wallet found\n\n` +
        `Use /start to create a wallet first`
      );
    }
    
    const processingMsg = await bot.sendMessage(chatId, 
      `🔍 *Processing your question...*\n\n` +
      `"${question}"\n\n` +
      `💸 Deducting ${AI_PAYMENT_AMOUNT} STX from your wallet...\n` +
      `⏳ Please wait (this may take 10-30 seconds)...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await makeAIPaidRequest(wallet.privateKey, question, chatId);
      
      const txUrl = `https://explorer.hiro.so/txid/${result.payment.transaction}?chain=${NETWORK}`;
      
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      
      bot.sendMessage(chatId, 
        `${result.answer}\n\n` +
        ` [View Transaction on Explorer](${txUrl})`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      
      if (error.response?.status === 402) {
        bot.sendMessage(chatId, 
          ` *Payment Required*\n\n` +
          `Your payment could not be processed.\n\n` +
          `Possible reasons:\n` +
          `• Insufficient balance (need ${AI_PAYMENT_AMOUNT} STX)\n` +
          `• Network congestion\n` +
          `• Invalid transaction\n\n` +
          `Use /balance to check your funds\n\n` +
          `Your wallet: \`${wallet.address}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        console.error('Query error:', error);
        bot.sendMessage(chatId, 
          ` *Error Processing Request*\n\n` +
          `${error.message}\n\n` +
          `Please try again in a moment.\n` +
          `If the problem persists, contact support.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  });

  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    if (!msg.text) return;
    
    const wallet = await getUserWallet(msg.chat.id);
    if (!wallet) {
      return bot.sendMessage(msg.chat.id, 
        ` No wallet found\n\n` +
        `Use /start to create a wallet first`
      );
    }
    
    bot.sendMessage(msg.chat.id, 
      ` *Tip:* Use the /ask command\n\n` +
      `Example:\n` +
      `/ask What is blockchain?\n\n` +
      `Your message: "${msg.text}"\n\n` +
      `Try: \`/ask ${msg.text}\``,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('polling_error', (error) => console.error('Telegram polling error:', error));
  
  console.log(' Bot ready! Try it: https://t.me/X402AI_BOT');
}


app.listen(PORT, async () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Network: ${NETWORK}`);
  console.log(` Bot address: ${BOT_ADDRESS}`);
  console.log(` Payment amount: ${AI_PAYMENT_AMOUNT} STX`);
  console.log(` Backend URL: ${BACKEND_URL || 'Not set'}`);
  
  await initBot();
});