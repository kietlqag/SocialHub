import express from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getUsers,
  getDashboards,
  getDashboardDetail,
  createUser,
  updateUser,
  deleteUser,
  getActivity,
  duplicateDashboardAdmin,
  updateDashboardStatus,
  deleteDashboardAdmin,
  listDashboardTables,
  addDashboardTable,
  updateDashboardTable,
  deleteDashboardTable,
  previewDashboardTable,
  listDashboardTableRecords,
} from "../controllers/adminController.js";
import {
  listAdminNotificationsController,
  createAdminNotificationController,
  updateAdminNotificationController,
  deleteAdminNotificationController,
} from "../controllers/notificationAdminController.js";

const router = express.Router();

// Mounting at /admin in server.js
router.get("/users", authenticate, requireAdmin, getUsers);
router.post("/users", authenticate, requireAdmin, createUser);
router.patch("/users/:id", authenticate, requireAdmin, updateUser);
router.delete("/users/:id", authenticate, requireAdmin, deleteUser);

router.get("/dashboards", authenticate, requireAdmin, getDashboards);
router.get("/dashboards/:id", authenticate, requireAdmin, getDashboardDetail);
router.post("/dashboards/:id/duplicate", authenticate, requireAdmin, duplicateDashboardAdmin);
router.patch("/dashboards/:id/status", authenticate, requireAdmin, updateDashboardStatus);
router.delete("/dashboards/:id", authenticate, requireAdmin, deleteDashboardAdmin);
router.get("/dashboards/:id/tables", authenticate, requireAdmin, listDashboardTables);
router.post("/dashboards/:id/tables", authenticate, requireAdmin, addDashboardTable);
router.patch("/dashboards/:id/tables/:tableKey", authenticate, requireAdmin, updateDashboardTable);
router.delete("/dashboards/:id/tables/:tableKey", authenticate, requireAdmin, deleteDashboardTable);
router.get("/dashboards/:id/tables/:tableKey/preview", authenticate, requireAdmin, previewDashboardTable);
router.get("/dashboards/:id/tables/:tableKey/records", authenticate, requireAdmin, listDashboardTableRecords);

router.get("/activity", authenticate, requireAdmin, getActivity);
router.get("/notifications", authenticate, requireAdmin, listAdminNotificationsController);
router.post("/notifications", authenticate, requireAdmin, createAdminNotificationController);
router.patch("/notifications/:id", authenticate, requireAdmin, updateAdminNotificationController);
router.delete("/notifications/:id", authenticate, requireAdmin, deleteAdminNotificationController);

export default router;
