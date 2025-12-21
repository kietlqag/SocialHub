import { MongoClient } from "mongodb";
import pg from "pg";
import "dotenv/config";

const email = "pghgiahuy201@gmail.com";

const mongo = new MongoClient(process.env.MONGODB_SOCIALHUB_URI);
await mongo.connect();
const db = mongo.db(process.env.MONGODB_SOCIALHUB_DBNAME || "socialhub");

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const u = await pool.query(
  `SELECT id, email, full_name, company, role FROM users WHERE email = $1`,
  [email]
);

const user = u.rows[0] || null;
if (!user) {
  console.log({ email, error: "User not found in Postgres" });
  await mongo.close();
  await pool.end();
  process.exit(0);
}

const userId = String(user.id);
const filter = {
  $or: [
    { "ui.userId": userId },
    { userId },
    { ownerId: userId },
  ],
};

const own = await db.collection("dashboards").countDocuments(filter);

const dashboards = await db
  .collection("dashboards")
  .find(filter, { projection: { name: 1, createdAt: 1, updatedAt: 1 } })
  .sort({ createdAt: -1 })
  .toArray();

console.log({
  email,
  userId,
  ownDashboards: own,
  dashboards,
  user,
});

await mongo.close();
await pool.end();
