# x402 AI Telegram Bot 

> AI-powered Telegram bot with blockchain payments using x402-stacks protocol on Stacks mainnet

[![Telegram Bot](https://img.shields.io/badge/Try%20Bot-@X402AI__BOT-blue?logo=telegram)](https://t.me/X402AI_BOT)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Hackathon Submission

A Telegram bot that enables users to:
- Generate Stacks blockchain wallets automatically
- Pay for AI queries using STX cryptocurrency
- Receive NFT receipts for each successful payment
- All powered by the **x402-stacks** HTTP 402 payment protocol

## Demo

**Try the bot:** [https://t.me/X402AI_BOT](https://t.me/X402AI_BOT)

**Bot Commands:**
```
/start - Generate your Stacks wallet
/balance - Check your STX balance
/ask <question> - Ask AI (costs 0.03 STX)
/info - Learn how the bot works
/export - Export your private key
```

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Telegram   │ ──────> │   Express    │ ──────> │  x402-stacks    │
│     Bot     │         │    Server    │         │   Facilitator   │
└─────────────┘         └──────────────┘         └─────────────────┘
       │                       │                          │
       │                       ├──────────────────────────┤
       │                       │  Payment Verification     │
       │                       └──────────┬────────────────┘
       │                                  │
       │                                  ▼
       │                          ┌──────────────┐
       └─────────────────────────>│   Stacks     │
                                  │  Blockchain  │
                                  └──────────────┘
```

## NFT Contract

**Contract Address:** `SP9XVR5B0HRWZW253KD9H817PKSXNCRFQ8JFCM1V.ai-nft`

**Network:** Stacks Mainnet

**Purpose:** Each successful AI query payment mints an NFT as a receipt/proof of purchase

**View on Explorer:** 
- [Contract Details](https://explorer.hiro.so/txid/SP9XVR5B0HRWZW253KD9H817PKSXNCRFQ8JFCM1V.ai-nft?chain=mainnet)

## Features

###  Implemented
- [x] Telegram bot interface with wallet management
- [x] Automatic Stacks wallet generation for users
- [x] STX balance checking via Hiro API
- [x] x402-stacks payment middleware on Express endpoints
- [x] MongoDB storage for wallets and transactions
- [x] NFT smart contract deployed on mainnet
- [x] HTTP 402 Payment Required implementation
- [x] Wallet import/export functionality
- [x] Full client-side payment flow integration
- [x] Actual AI API integration (OpenAI)
- [x] Automated NFT minting on payment confirmation
- [x] Real-time payment status updates

##  Tech Stack

- **Backend:** Node.js + Express
- **Bot:** node-telegram-bot-api
- **Payment:** x402-stacks (HTTP 402 protocol)
- **Blockchain:** Stacks (STX cryptocurrency)
- **Database:** MongoDB Atlas
- **NFT:** Clarity smart contract on Stacks mainnet

##  Installation

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Telegram Bot Token (from @BotFather)
- Stacks wallet with STX on mainnet

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR-USERNAME/x402-ai-telegram-bot.git
cd x402-ai-telegram-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your values
```

4. **Required environment variables:**
```env
TELEGRAM_TOKEN=your_telegram_bot_token
BOT_PRIVATE_KEY=your_bot_stacks_private_key
MONGO_URI=your_mongodb_connection_string
NETWORK=mainnet
AI_PAYMENT_AMOUNT=0.03
FACILITATOR_URL=https://facilitator.stacksx402.com
```

5. **Start the bot:**
```bash
npm start
```

## Usage

### For Users

1. **Start the bot** on Telegram: [@X402AI_BOT](https://t.me/X402AI_BOT)

2. **Get your wallet:**
```
/start
```
The bot generates a Stacks wallet for you automatically.

3. **Fund your wallet:**
Transfer STX to your generated wallet address (minimum 0.03 STX)

4. **Check balance:**
```
/balance
```

5. **Ask AI a question:**
```
/ask What is blockchain?
```

### For Developers

**Test the protected endpoint:**
```bash
# Without payment - returns 402
curl -X POST http://localhost:3000/api/ai-query \
  -H "Content-Type: application/json" \
  -d '{"question":"test","chatId":123}'

# Response: 402 Payment Required with payment-required header
```

**Verify x402 integration:**
```javascript
import { wrapAxiosWithPayment, privateKeyToAccount } from 'x402-stacks';

const account = privateKeyToAccount(privateKey, 'mainnet');
const api = wrapAxiosWithPayment(axios.create(), account);
const response = await api.post('/api/ai-query', { question, chatId });
```

##  API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | None | Health check |
| `/health` | GET | None | Server status |
| `/api/ai-query` | POST | x402 | Protected AI query endpoint |

##  Security

-  Private keys stored securely in MongoDB
-  Environment variables for sensitive data
-  .gitignore prevents credential leaks
-  Payment verification via x402-stacks facilitator

##  x402-stacks Integration

This project demonstrates the **x402-stacks** protocol for HTTP 402-based payments:

```javascript
// Server-side: Protect endpoints with payment middleware
app.post('/api/ai-query',
  paymentMiddleware({
    amount: STXtoMicroSTX(0.03),
    payTo: BOT_ADDRESS,
    network: 'mainnet',
    facilitatorUrl: 'https://facilitator.stacksx402.com',
  }),
  handler
);

// Client-side: Automatic payment handling
const api = wrapAxiosWithPayment(axios.create(), account);
const response = await api.post('/api/ai-query', data);
```

##  Demo video

- [ Video demo](https://drive.google.com/file/d/1lKTKA79HZpEnt8hTeJvZO9bq6ZpIGzjy/view?usp=drivesdk)
 

##  Known Limitations

1. **Payment Flow:** Client-side payment signing not yet fully automated in Telegram
2. **AI Integration:** Using placeholder responses (AI API integration pending)
3. **NFT Minting:** Automatic minting on payment confirmation in development
4. **Deployment:** Backend needs to be deployed to public URL for full functionality




**Try it now:** [https://t.me/X402AI_BOT](https://t.me/X402AI_BOT)

**Bot Address:** `SP9XVR5B0HRWZW253KD9H817PKSXNCRFQ8JFCM1V`

**NFT Contract:** `SP9XVR5B0HRWZW253KD9H817PKSXNCRFQ8JFCM1V.ai-nft`