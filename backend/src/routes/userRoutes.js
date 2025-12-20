import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchUsers } from "../controllers/userController.js";

const router = Router();

router.get("/users", asyncHandler(searchUsers));

export default router;
