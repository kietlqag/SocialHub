import crypto from "crypto";
import { HttpError } from "../utils/httpError.js";
import {
  listApprovedReviews,
  getApprovedReviewStats,
  findRecentSubmission,
  findReviewByUserId,
  getReviewByUserId,
  insertReview,
  updateReviewStatus as updateReviewStatusRepo,
  updateReviewById,
} from "../repositories/reviewRepository.js";

const clampLimit = (value, fallback = 6, max = 12) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || req.ip || null;
};

const hashIp = (ip) => {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
};

const normalizeStatus = (value) => String(value || "").toLowerCase();

export async function listReviews(req, res) {
  const limit = clampLimit(req.query?.limit, 6, 12);
  const items = await listApprovedReviews(limit);
  res.json({ items });
}

export async function getReviewStats(req, res) {
  const stats = await getApprovedReviewStats();
  res.json({
    avgRating: Number(stats.avg_rating || 0),
    total: Number(stats.total || 0),
  });
}

export async function createReview(req, res) {
  const rating = Number(req.body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Rating must be between 1 and 5");
  }
  const message = String(req.body?.message || "").trim();
  if (message.length < 10) {
    throw new HttpError(400, "Message must be at least 10 characters");
  }

  const name = req.body?.name ? String(req.body.name).trim() : null;
  const email = req.body?.email ? String(req.body.email).trim() : req.user?.email || null;
  const source = req.body?.source ? String(req.body.source).trim() : "contact_page";
  const userId = req.user?.id || null;
  const ipHash = hashIp(getClientIp(req));

  if (userId) {
    const existing = await findReviewByUserId(userId);
    if (existing) {
      throw new HttpError(409, "You have already submitted a review.");
    }
  }

  const recent = await findRecentSubmission({ email, ipHash });
  if (recent) {
    throw new HttpError(429, "Please wait before submitting another review.");
  }

  const review = await insertReview({
    userId,
    name,
    email,
    rating,
    message,
    source,
    status: "approved",
    ipHash,
    userAgent: req.headers["user-agent"] || null,
  });

  res.status(201).json({ review });
}

export async function getMyReview(req, res) {
  const userId = req.user?.id;
  if (!userId) throw new HttpError(401, "Unauthorized");
  const review = await getReviewByUserId(userId);
  res.json({ review });
}

export async function updateMyReview(req, res) {
  const userId = req.user?.id;
  if (!userId) throw new HttpError(401, "Unauthorized");
  const rating = typeof req.body?.rating !== "undefined" ? Number(req.body.rating) : undefined;
  const message = typeof req.body?.message !== "undefined" ? String(req.body.message).trim() : undefined;

  if (typeof rating !== "undefined" && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    throw new HttpError(400, "Rating must be between 1 and 5");
  }
  if (typeof message !== "undefined" && message.length < 10) {
    throw new HttpError(400, "Message must be at least 10 characters");
  }

  const updated = await updateReviewById(req.params.id, userId, {
    rating,
    message,
  });
  if (!updated) return res.status(404).json({ error: "Review not found" });
  res.json({ review: updated });
}

export async function updateReviewStatus(req, res) {
  const status = normalizeStatus(req.body?.status);
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new HttpError(400, "Invalid status");
  }
  const updated = await updateReviewStatusRepo(req.params.id, status);
  if (!updated) return res.status(404).json({ error: "Review not found" });
  res.json({ review: updated });
}
