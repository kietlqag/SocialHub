import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getNotificationPrefs, updateNotificationPrefs } from "../controllers/notificationPreferencesController.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(getNotificationPrefs));
router.put("/", asyncHandler(updateNotificationPrefs));

export default router;
