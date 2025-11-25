import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  forgotPassword,
  githubAuth,
  githubCallback,
  googleAuth,
  googleCallback,
  login,
  me,
  register,
  resendVerificationCode,
  resetPasswordController,
  verifyEmailCode,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", authenticate, asyncHandler(me));
router.post("/verify-email", asyncHandler(verifyEmailCode));
router.post("/resend-verification", asyncHandler(resendVerificationCode));
router.post("/forgot", asyncHandler(forgotPassword));
router.post("/reset", asyncHandler(resetPasswordController));
router.get("/google", asyncHandler(googleAuth));
router.get("/google/callback", asyncHandler(googleCallback));
router.get("/github", asyncHandler(githubAuth));
router.get("/github/callback", asyncHandler(githubCallback));

export default router;
