import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { listReviews, getReviewStats, createReview, updateReviewStatus, getMyReview, updateMyReview, deleteMyReview } from "../controllers/reviewController.js";

const router = express.Router();

router.get("/", asyncHandler(listReviews));
router.get("/stats", asyncHandler(getReviewStats));
router.post("/", optionalAuth, asyncHandler(createReview));
router.get("/me", authenticate, asyncHandler(getMyReview));
router.patch("/:id", authenticate, asyncHandler(updateMyReview));
router.delete("/:id", authenticate, asyncHandler(deleteMyReview));
router.patch("/:id/status", authenticate, requireAdmin, asyncHandler(updateReviewStatus));

export default router;
