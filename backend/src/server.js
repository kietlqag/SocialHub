import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import orgRoutes from "./routes/orgRoutes.js";
import { initDb } from "./db.js";
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

// Direct login endpoint for clarity alongside /auth/login
app.post("/login", asyncHandler(login));

app.use("/auth", authRoutes);
app.use("/ai", aiRoutes);
app.use(orgRoutes);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err instanceof HttpError && err.status ? err.status : err.status || 500;
  const message = err.status ? err.message : "Internal Server Error";
  res.status(status).json({ error: message });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
