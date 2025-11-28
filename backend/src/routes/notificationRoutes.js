import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listNotifications, createNotification, deleteNotification, updateNotification } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", asyncHandler(listNotifications));
router.post("/", asyncHandler(createNotification));
router.delete("/:id", asyncHandler(deleteNotification));
router.patch("/:id", asyncHandler(updateNotification));

export default router;
