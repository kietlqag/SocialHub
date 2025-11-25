import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL not set. Backend will fail to connect until provided.");
}

export const pool = new Pool({
  connectionString,
});

export async function query(text, params) {
  return pool.query(text, params);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "../db/schema.sql");

export async function initDb() {
  if (!fs.existsSync(schemaPath)) {
    console.warn("Schema file not found. Skipping automatic migrations.");
    return;
  }

const schema = fs.readFileSync(schemaPath, "utf-8");
const statements = schema
  .split(/;\s*(?:\n|$)/g)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length && !stmt.startsWith("--"));

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      console.error("Failed to run init statement:", sql.slice(0, 80), err.message);
    }
  }
}
