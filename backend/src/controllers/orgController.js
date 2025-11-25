import {
  bindServiceToDashboard,
  createDashboard,
  createDataSource,
  createOrganization,
  createRecommendation,
  createServiceProfile,
  createWidget,
  listDashboardServices,
  listDashboards,
  listDataSources,
  listRecommendations,
  listServiceProfiles,
  listUserOrganizations,
  listWidgets,
} from "../services/platformService.js";
import { suggestForOrganization } from "../services/aiService.js";

export async function createOrgController(req, res) {
  const organization = await createOrganization(req.user.id, req.body);
  res.status(201).json({ organization });
}

export async function listOrgsController(req, res) {
  const organizations = await listUserOrganizations(req.user.id);
  res.json({ organizations });
}

export async function createDataSourceController(req, res) {
  const dataSource = await createDataSource(req.user.id, req.params.orgId, req.body);
  res.status(201).json({ dataSource });
}

export async function listDataSourcesController(req, res) {
  const dataSources = await listDataSources(req.user.id, req.params.orgId);
  res.json({ dataSources });
}

export async function createDashboardController(req, res) {
  const dashboard = await createDashboard(req.user.id, req.params.orgId, req.body);
  res.status(201).json({ dashboard });
}

export async function listDashboardsController(req, res) {
  const dashboards = await listDashboards(req.user.id, req.params.orgId);
  res.json({ dashboards });
}

export async function createWidgetController(req, res) {
  const widget = await createWidget(req.user.id, req.params.orgId, req.params.dashboardId, req.body);
  res.status(201).json({ widget });
}

export async function listWidgetsController(req, res) {
  const widgets = await listWidgets(req.user.id, req.params.orgId, req.params.dashboardId);
  res.json({ widgets });
}

export async function createServiceProfileController(req, res) {
  const service = await createServiceProfile(req.user.id, req.params.orgId, req.body);
  res.status(201).json({ service });
}

export async function listServiceProfilesController(req, res) {
  const services = await listServiceProfiles(req.user.id, req.params.orgId);
  res.json({ services });
}

export async function bindServiceController(req, res) {
  const binding = await bindServiceToDashboard(
    req.user.id,
    req.params.orgId,
    req.params.dashboardId,
    req.body
  );
  res.status(201).json({ binding });
}

export async function listDashboardServicesController(req, res) {
  const bindings = await listDashboardServices(req.user.id, req.params.orgId, req.params.dashboardId);
  res.json({ bindings });
}

export async function createRecommendationController(req, res) {
  const recommendation = await createRecommendation(req.user.id, req.params.orgId, req.body);
  res.status(201).json({ recommendation });
}

export async function listRecommendationsController(req, res) {
  const recommendations = await listRecommendations(req.user.id, req.params.orgId);
  res.json({ recommendations });
}

export async function suggestForOrgController(req, res) {
  const { orgId } = req.params;
  const { message, goals, metrics } = req.body || {};
  const suggestion = await suggestForOrganization(req.user.id, orgId, { message, goals, metrics });
  res.json({ suggestion });
}
