import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getUnreadCount } from "../controllers/notificationCountController.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(getUnreadCount));

export default router;
