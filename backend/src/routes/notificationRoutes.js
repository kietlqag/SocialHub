import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { listNotifications, createNotification, deleteNotification, updateNotification } from "../controllers/notificationController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(listNotifications));
router.post("/", asyncHandler(createNotification));
router.delete("/:id", asyncHandler(deleteNotification));
router.patch("/:id", asyncHandler(updateNotification));

export default router;
