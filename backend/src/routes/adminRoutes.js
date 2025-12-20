import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUsers } from "../controllers/adminController.js";

const router = express.Router();

// Mounting at /admin in server.js, so keep route path scoped to /users
router.get("/users", authenticate, requireAdmin, getUsers);

export default router;
