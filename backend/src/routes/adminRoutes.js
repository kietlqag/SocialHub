import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getUsers, getDashboards, getDashboardDetail, createUser, updateUser, deleteUser, getActivity, duplicateDashboardAdmin, updateDashboardStatus } from "../controllers/adminController.js";
import { listAdminNotifications, createAdminNotification, updateAdminNotification, deleteAdminNotification } from "../controllers/notificationAdminController.js";
import { listDashboardTables, addDashboardTable, updateDashboardTable, deleteDashboardTable, previewDashboardTable } from "../controllers/adminController.js";

const router = express.Router();

// Mounting at /admin in server.js, so keep route path scoped to /users
router.get("/users", authenticate, requireAdmin, getUsers);
router.post("/users", authenticate, requireAdmin, createUser);
router.patch("/users/:id", authenticate, requireAdmin, updateUser);
router.delete("/users/:id", authenticate, requireAdmin, deleteUser);
router.get("/dashboards", authenticate, requireAdmin, getDashboards);
router.get("/dashboards/:id", authenticate, requireAdmin, getDashboardDetail);
router.post("/dashboards/:id/duplicate", authenticate, requireAdmin, duplicateDashboardAdmin);
router.patch("/dashboards/:id/status", authenticate, requireAdmin, updateDashboardStatus);
router.get("/dashboards/:id/tables", authenticate, requireAdmin, listDashboardTables);
router.post("/dashboards/:id/tables", authenticate, requireAdmin, addDashboardTable);
router.patch("/dashboards/:id/tables/:tableKey", authenticate, requireAdmin, updateDashboardTable);
router.delete("/dashboards/:id/tables/:tableKey", authenticate, requireAdmin, deleteDashboardTable);
router.get("/dashboards/:id/tables/:tableKey/preview", authenticate, requireAdmin, previewDashboardTable);
router.get("/activity", authenticate, requireAdmin, getActivity);
router.get("/notifications", authenticate, requireAdmin, listAdminNotifications);
router.post("/notifications", authenticate, requireAdmin, createAdminNotification);
router.patch("/notifications/:id", authenticate, requireAdmin, updateAdminNotification);
router.delete("/notifications/:id", authenticate, requireAdmin, deleteAdminNotification);

export default router;
