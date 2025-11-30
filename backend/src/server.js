import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import orgRoutes from "./routes/orgRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { initDb } from "./db.js";
import { initMongo, getSocialhubDb } from "./mongo.js";
import { HttpError } from "./utils/httpError.js";
import { login } from "./controllers/authController.js";
import { asyncHandler } from "./utils/asyncHandler.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// quick endpoint to confirm MongoDB socialhub connection
app.get("/mongo-health", async (req, res) => {
  try {
    const db = getSocialhubDb();
    const collections = await db.listCollections().toArray();
    res.json({ ok: true, collections: collections.map((c) => c.name) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Direct login endpoint for clarity alongside /auth/login
app.post("/login", asyncHandler(login));

app.use("/auth", authRoutes);
app.use("/ai", aiRoutes);
app.use(orgRoutes);
// Notifications now served from Postgres — mount API at /notifications
app.use("/notifications", notificationRoutes);
// Profile endpoints
app.use("/profile", profileRoutes);
app.use(dashboardRoutes);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err instanceof HttpError && err.status ? err.status : err.status || 500;
  const message = err.status ? err.message : "Internal Server Error";
  res.status(status).json({ error: message });
});

async function start() {
  await initMongo();
  await initDb();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
