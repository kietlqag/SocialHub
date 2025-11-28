import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// Use env var specifically for the socialhub connection, fall back to MONGODB_URI
const MONGO_SOCIALHUB_URI = process.env.MONGODB_SOCIALHUB_URI || process.env.MONGODB_URI;
const MONGO_SOCIALHUB_DBNAME = process.env.MONGODB_SOCIALHUB_DBNAME || "socialhub";

let mongoClient = null;
let socialhubDb = null;

export async function initMongo() {
  if (!MONGO_SOCIALHUB_URI) {
    console.warn("MONGODB_SOCIALHUB_URI not provided — skipping MongoDB (socialhub) initialization.");
    return;
  }

  try {
    mongoClient = new MongoClient(MONGO_SOCIALHUB_URI, {
      // useUnifiedTopology is default in modern drivers
    });

    await mongoClient.connect();
    socialhubDb = mongoClient.db(MONGO_SOCIALHUB_DBNAME);
    console.log("Connected to MongoDB (socialhub) -> DB:", MONGO_SOCIALHUB_DBNAME);
  } catch (err) {
    console.error("Failed to initialize MongoDB (socialhub):", err.message);
    throw err;
  }
}

export function getSocialhubDb() {
  if (!socialhubDb) {
    throw new Error("MongoDB (socialhub) is not initialized. Call initMongo() first.");
  }
  return socialhubDb;
}

export function getMongoClient() {
  return mongoClient;
}

export async function closeMongo() {
  if (mongoClient) await mongoClient.close();
}
