import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  generateStructure,
  createDashboard,
  listDashboard,
  deleteDashboard,
} from "../controllers/dashboardController.js";

const router = Router();

router.post("/dashboards/generate", asyncHandler(generateStructure));
router.post("/dashboards", asyncHandler(createDashboard));
router.get("/dashboards", asyncHandler(listDashboard));
router.delete("/dashboards/:id", asyncHandler(deleteDashboard));

export default router;
