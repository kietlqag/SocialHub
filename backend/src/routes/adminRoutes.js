import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUsers, getDashboards } from "../controllers/adminController.js";

const router = express.Router();

// Mounting at /admin in server.js, so keep route path scoped to /users
router.get("/users", authenticate, requireAdmin, getUsers);
router.get("/dashboards", authenticate, requireAdmin, getDashboards);

export default router;
