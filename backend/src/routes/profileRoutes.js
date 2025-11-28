import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getProfile, patchProfile } from "../controllers/profileController.js";

const router = express.Router();

// GET /profile - returns the current user's profile
router.get("/", authenticate, getProfile);

// PATCH /profile - update profile fields
router.patch("/", authenticate, patchProfile);

export default router;
