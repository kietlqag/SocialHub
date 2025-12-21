import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  generateStructure,
  createDashboard,
  listDashboard,
  listDashboardTables,
  createDashboardTable,
  deleteDashboard,
  createDashboardRecord,
  getDashboardRecords,
  getDashboardData,
  getDashboardRecordController,
  updateDashboardRecordController,
  deleteDashboardRecordController,
  listWidgets,
  createWidget,
  deleteWidget,
  hideWidget,
  createInsight,
  deleteInsight,
  patchInsight,
  getDashboardByIdController,
} from "../controllers/dashboardController.js";
import {
  getDashboardAccess,
  updateDashboardAccess,
  updateDashboardAccessMode,
  addDashboardUserAssignment,
  updateDashboardUserAssignment,
  removeDashboardUserAssignment,
} from "../controllers/dashboardAccessController.js";
import { getPublicDashboards } from "../controllers/publicDashboardController.js";
import { getTableSchema, updateTableSchema } from "../controllers/tableSchemaController.js";

const router = Router();

router.post("/dashboards/generate", asyncHandler(generateStructure));
router.post("/dashboards", asyncHandler(createDashboard));
router.get("/dashboards", asyncHandler(listDashboard));
router.get("/dashboards/public", asyncHandler(getPublicDashboards));
router.get("/dashboards/:id", asyncHandler(getDashboardByIdController));
router.get("/dashboards/:dashboardId/tables", asyncHandler(listDashboardTables));
router.post("/dashboards/:dashboardId/tables/create", asyncHandler(createDashboardTable));
router.delete("/dashboards/:id", asyncHandler(deleteDashboard));
router.post("/dashboards/:id/records", asyncHandler(createDashboardRecord));
router.post("/dashboards/records", asyncHandler(createDashboardRecord));
router.get("/records", asyncHandler(getDashboardRecords));
router.get("/dashboards/:id/tables/:tableKey/records/:recordId", asyncHandler(getDashboardRecordController));
router.put("/dashboards/:id/tables/:tableKey/records/:recordId", asyncHandler(updateDashboardRecordController));
router.delete("/dashboards/:id/tables/:tableKey/records/:recordId", asyncHandler(deleteDashboardRecordController));
router.get("/dashboards/:dashboardId/tables/:tableKey/schema", asyncHandler(getTableSchema));
router.put("/dashboards/:dashboardId/tables/:tableKey/schema", asyncHandler(updateTableSchema));
router.get("/dashboards/:id/data", asyncHandler(getDashboardData));
router.get("/dashboards/:id/widgets", asyncHandler(listWidgets));
router.post("/dashboards/:id/widgets", asyncHandler(createWidget));
router.delete("/dashboards/:id/widgets/:widgetId", asyncHandler(deleteWidget));
router.post("/dashboards/:id/widget-overrides/hide", asyncHandler(hideWidget));
router.post("/dashboards/:id/insights", asyncHandler(createInsight));
router.delete("/dashboards/:id/insights/:insightId", asyncHandler(deleteInsight));
router.patch("/dashboards/:id/insights/:insightId", asyncHandler(patchInsight));
router.get("/dashboards/:dashboardId/access", asyncHandler(getDashboardAccess));
router.patch("/dashboards/:dashboardId/access", asyncHandler(updateDashboardAccess));
router.patch("/dashboards/:dashboardId/access-mode", asyncHandler(updateDashboardAccessMode));
router.post("/dashboards/:dashboardId/users", asyncHandler(addDashboardUserAssignment));
router.patch("/dashboards/:dashboardId/users/:assignmentId", asyncHandler(updateDashboardUserAssignment));
router.delete("/dashboards/:dashboardId/users/:assignmentId", asyncHandler(removeDashboardUserAssignment));

export default router;
