import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUsers, getDashboards, getDashboardDetail, createUser, updateUser, deleteUser, getActivity } from "../controllers/adminController.js";
import { listAdminNotifications, createAdminNotification, updateAdminNotification, deleteAdminNotification } from "../controllers/notificationAdminController.js";

const router = express.Router();

// Mounting at /admin in server.js, so keep route path scoped to /users
router.get("/users", authenticate, requireAdmin, getUsers);
router.post("/users", authenticate, requireAdmin, createUser);
router.patch("/users/:id", authenticate, requireAdmin, updateUser);
router.delete("/users/:id", authenticate, requireAdmin, deleteUser);
router.get("/dashboards", authenticate, requireAdmin, getDashboards);
router.get("/dashboards/:id", authenticate, requireAdmin, getDashboardDetail);
router.get("/activity", authenticate, requireAdmin, getActivity);
router.get("/notifications", authenticate, requireAdmin, listAdminNotifications);
router.post("/notifications", authenticate, requireAdmin, createAdminNotification);
router.patch("/notifications/:id", authenticate, requireAdmin, updateAdminNotification);
router.delete("/notifications/:id", authenticate, requireAdmin, deleteAdminNotification);

export default router;
