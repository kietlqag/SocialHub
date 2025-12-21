import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUsers, getDashboards, getDashboardDetail, createUser, updateUser, deleteUser } from "../controllers/adminController.js";

const router = express.Router();

// Mounting at /admin in server.js, so keep route path scoped to /users
router.get("/users", authenticate, requireAdmin, getUsers);
router.post("/users", authenticate, requireAdmin, createUser);
router.patch("/users/:id", authenticate, requireAdmin, updateUser);
router.delete("/users/:id", authenticate, requireAdmin, deleteUser);
router.get("/dashboards", authenticate, requireAdmin, getDashboards);
router.get("/dashboards/:id", authenticate, requireAdmin, getDashboardDetail);

export default router;
