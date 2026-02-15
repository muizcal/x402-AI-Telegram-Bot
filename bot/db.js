// db.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: "../.env" });

const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI not set in .env");

const client = new MongoClient(uri, { tls: true });
await client.connect();
console.log("✅ MongoDB connected");

const db = client.db("x402_ai");
export const wallets = db.collection("wallets");

export async function saveWallet(userId, wallet) {
  await wallets.updateOne({ userId }, { $set: { userId, ...wallet } }, { upsert: true });
}

export async function getWallet(userId) {
  return await wallets.findOne({ userId });
}

export async function deleteWallet(userId) {
  return await wallets.deleteOne({ userId });
}
