import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_SOCIALHUB_URI = process.env.MONGODB_SOCIALHUB_URI || process.env.MONGODB_URI;
const MONGO_SOCIALHUB_DBNAME = process.env.MONGODB_SOCIALHUB_DBNAME || "socialhub";

export async function initMongoose() {
  if (!MONGO_SOCIALHUB_URI) {
    console.warn("MONGODB_SOCIALHUB_URI not provided – skipping mongoose initialization.");
    return;
  }
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }
  await mongoose.connect(MONGO_SOCIALHUB_URI, { dbName: MONGO_SOCIALHUB_DBNAME });
  console.log("Connected to MongoDB via mongoose -> DB:", MONGO_SOCIALHUB_DBNAME);
}

export { mongoose };
