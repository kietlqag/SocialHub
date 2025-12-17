import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  generateStructure,
  createDashboard,
  listDashboard,
  deleteDashboard,
  createDashboardRecord,
  getDashboardRecords,
} from "../controllers/dashboardController.js";

const router = Router();

router.post("/dashboards/generate", asyncHandler(generateStructure));
router.post("/dashboards", asyncHandler(createDashboard));
router.get("/dashboards", asyncHandler(listDashboard));
router.delete("/dashboards/:id", asyncHandler(deleteDashboard));
router.post("/dashboards/:id/records", asyncHandler(createDashboardRecord));
router.post("/dashboards/records", asyncHandler(createDashboardRecord));
router.get("/records", asyncHandler(getDashboardRecords));

export default router;
