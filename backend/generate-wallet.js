#!/usr/bin/env node
// Script to generate a new Stacks wallet for the bot

import { generateKeypair } from 'x402-stacks';

const NETWORK = process.env.NETWORK || 'testnet';

console.log('🔑 Generating new Stacks wallet...\n');

const keypair = generateKeypair(NETWORK);

console.log('✅ Wallet Generated Successfully!\n');
console.log('═'.repeat(60));
console.log('Network:', NETWORK);
console.log('Address:', keypair.address);
console.log('Private Key:', keypair.privateKey);
console.log('═'.repeat(60));

console.log('\n📋 Next Steps:\n');
console.log('1. Add to your .env file:');
console.log(`   BOT_PRIVATE_KEY=${keypair.privateKey}`);
console.log('\n2. Fund this address with STX:');
console.log(`   Address: ${keypair.address}`);

if (NETWORK === 'testnet') {
  console.log('\n3. Get testnet STX from faucet:');
  console.log('   https://explorer.hiro.so/sandbox/faucet?chain=testnet');
}

console.log('\n⚠️  IMPORTANT: Keep your private key secure!');
console.log('   Never commit it to version control or share it publicly.\n');

// Show explorer link
const explorerUrl = NETWORK === 'mainnet'
  ? `https://explorer.hiro.so/address/${keypair.address}?chain=mainnet`
  : `https://explorer.hiro.so/address/${keypair.address}?chain=testnet`;

console.log('🔍 View on Explorer:');
console.log(`   ${explorerUrl}\n`);