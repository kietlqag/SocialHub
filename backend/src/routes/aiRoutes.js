import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  chatController,
  conversationMessagesController,
  createConversationController,
  deleteConversationController,
  feedbackController,
  listConversationsController,
  sendConversationMessageController,
  suggestForOrgController,
  updateConversationController,
} from "../controllers/aiController.js";

const router = Router();

router.post("/chat", authenticate, asyncHandler(chatController));
router.get("/conversations", authenticate, asyncHandler(listConversationsController));
router.post("/conversations", authenticate, asyncHandler(createConversationController));
router.get(
  "/conversations/:conversationId/messages",
  authenticate,
  asyncHandler(conversationMessagesController)
);
router.post(
  "/conversations/:conversationId/messages",
  authenticate,
  asyncHandler(sendConversationMessageController)
);
router.delete("/conversations/:conversationId", authenticate, asyncHandler(deleteConversationController));
router.post(
  "/conversations/:conversationId/messages/:messageId/feedback",
  authenticate,
  asyncHandler(feedbackController)
);
router.patch("/conversations/:conversationId", authenticate, asyncHandler(updateConversationController));

export default router;
