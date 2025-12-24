import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import notificationPreferenceRoutes from "./routes/notificationPreferenceRoutes.js";
import notificationCountRoutes from "./routes/notificationCountRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { getDashboardData, listWidgets, createWidget, deleteWidget, hideWidget } from "./controllers/dashboardController.js";
import { initDb } from "./db.js";
import { initMongo, getSocialhubDb } from "./mongo.js";
import { initMongoose } from "./mongoose.js";
import { HttpError } from "./utils/httpError.js";
import { login } from "./controllers/authController.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

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
app.use("/api/reviews", reviewRoutes);
// Notifications now served from Postgres - mount API at /api/notifications (keep legacy /notifications)
app.use("/api/notifications", notificationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/api/notifications/preferences", notificationPreferenceRoutes);
app.use("/api/notifications/unread-count", notificationCountRoutes);
// Profile endpoints
app.use("/profile", profileRoutes);
app.use("/api", userRoutes);
// Direct mount for dashboard data (in addition to router) to avoid 404s
app.get("/api/dashboards/:id/data", asyncHandler(getDashboardData));
app.get("/api/dashboards/:id/widgets", asyncHandler(listWidgets));
app.post("/api/dashboards/:id/widgets", asyncHandler(createWidget));
app.delete("/api/dashboards/:id/widgets/:widgetId", asyncHandler(deleteWidget));
app.post("/api/dashboards/:id/widget-overrides/hide", asyncHandler(hideWidget));
app.use("/api", dashboardRoutes);
app.use("/admin", adminRoutes);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const logPath = path.resolve(__dirname, "../server-error.log");
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${req.method} ${req.originalUrl} :: ${err?.stack || err}\n`);
  } catch (_) {
    // ignore
  }
  console.error(err);
  const status = err instanceof HttpError && err.status ? err.status : err.status || 500;
  const message = err.status ? err.message : "Internal Server Error";
  const payload = { error: message, message };
  if (err?.references) {
    payload.references = err.references;
  }
  res.status(status).json(payload);
});

async function start() {
  await initMongoose();
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
