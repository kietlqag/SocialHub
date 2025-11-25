import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  bindServiceController,
  createDashboardController,
  createDataSourceController,
  createOrgController,
  createRecommendationController,
  createServiceProfileController,
  createWidgetController,
  listDashboardServicesController,
  listDashboardsController,
  listDataSourcesController,
  listOrgsController,
  listRecommendationsController,
  listServiceProfilesController,
  listWidgetsController,
  suggestForOrgController,
} from "../controllers/orgController.js";

const router = Router();

router.post("/orgs", authenticate, asyncHandler(createOrgController));
router.get("/orgs", authenticate, asyncHandler(listOrgsController));

router.post("/orgs/:orgId/datasources", authenticate, asyncHandler(createDataSourceController));
router.get("/orgs/:orgId/datasources", authenticate, asyncHandler(listDataSourcesController));

router.post("/orgs/:orgId/dashboards", authenticate, asyncHandler(createDashboardController));
router.get("/orgs/:orgId/dashboards", authenticate, asyncHandler(listDashboardsController));

router.post(
  "/orgs/:orgId/dashboards/:dashboardId/widgets",
  authenticate,
  asyncHandler(createWidgetController)
);
router.get(
  "/orgs/:orgId/dashboards/:dashboardId/widgets",
  authenticate,
  asyncHandler(listWidgetsController)
);

router.post("/orgs/:orgId/services", authenticate, asyncHandler(createServiceProfileController));
router.get("/orgs/:orgId/services", authenticate, asyncHandler(listServiceProfilesController));

router.post(
  "/orgs/:orgId/dashboards/:dashboardId/services",
  authenticate,
  asyncHandler(bindServiceController)
);
router.get(
  "/orgs/:orgId/dashboards/:dashboardId/services",
  authenticate,
  asyncHandler(listDashboardServicesController)
);

router.post("/orgs/:orgId/recommendations", authenticate, asyncHandler(createRecommendationController));
router.get("/orgs/:orgId/recommendations", authenticate, asyncHandler(listRecommendationsController));
router.post("/orgs/:orgId/ai/suggest", authenticate, asyncHandler(suggestForOrgController));

export default router;
