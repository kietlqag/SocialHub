import { query } from "../db.js";
import { parseJsonField } from "../utils/parsers.js";

export const mapOrganization = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  slug: row.slug,
  industry: row.industry,
  employeeCount: row.employee_count,
  dataVolume: row.data_volume,
  description: row.description,
  metadata: parseJsonField(row.metadata, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  role: row.role,
});

export const mapDataSource = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  type: row.type,
  status: row.status,
  config: parseJsonField(row.config, {}),
  lastSyncedAt: row.last_synced_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapDashboard = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  title: row.title,
  description: row.description,
  aiSummary: row.ai_summary,
  status: row.status,
  layout: parseJsonField(row.layout, []),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapWidget = (row) => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  dataSourceId: row.data_source_id,
  title: row.title,
  visualization: row.visualization,
  config: parseJsonField(row.config, {}),
  position: parseJsonField(row.position, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapServiceProfile = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  serviceType: row.service_type,
  status: row.status,
  config: parseJsonField(row.config, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapBinding = (row) => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  serviceProfileId: row.service_profile_id,
  scope: row.scope,
  createdAt: row.created_at,
  service: mapServiceProfile({
    ...row,
    organization_id: row.organization_id,
    name: row.service_name,
    service_type: row.service_type,
    status: row.service_status,
    config: row.service_config,
    created_at: row.service_created_at,
    updated_at: row.service_updated_at,
  }),
});

export const mapRecommendation = (row) => ({
  id: row.id,
  organizationId: row.organization_id,
  requestedBy: row.requested_by,
  prompt: parseJsonField(row.prompt, {}),
  result: parseJsonField(row.result, {}),
  status: row.status,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

export async function findMembership(userId, organizationId) {
  const res = await query(
    `SELECT id, role
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  );
  return res.rows[0] || null;
}

export async function findDashboardById(dashboardId) {
  const res = await query(
    `SELECT id, organization_id
     FROM dashboards
     WHERE id = $1`,
    [dashboardId]
  );
  return res.rows[0] || null;
}

export async function findServiceProfileById(serviceProfileId) {
  const res = await query(
    `SELECT id, organization_id
     FROM service_profiles
     WHERE id = $1`,
    [serviceProfileId]
  );
  return res.rows[0] || null;
}

export async function insertOrganization(ownerId, payload, slug) {
  const res = await query(
    `INSERT INTO organizations (owner_id, name, slug, industry, employee_count, data_volume, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      ownerId,
      payload.name,
      slug,
      payload.industry || null,
      payload.employeeCount ?? null,
      payload.dataVolume || null,
      payload.description || null,
      JSON.stringify(payload.metadata || {}),
    ]
  );
  return mapOrganization(res.rows[0]);
}

export async function upsertMember(organizationId, userId, role) {
  await query(
    `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [organizationId, userId, role]
  );
}

export async function listOrganizationsForUser(userId) {
  const res = await query(
    `SELECT o.*, m.role
     FROM organizations o
     JOIN organization_members m ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return res.rows.map(mapOrganization);
}

export async function getOrganizationById(id) {
  const res = await query(`SELECT * FROM organizations WHERE id = $1`, [id]);
  return res.rows[0] ? mapOrganization(res.rows[0]) : null;
}

export async function insertDataSource(organizationId, payload) {
  const res = await query(
    `INSERT INTO data_sources (organization_id, name, type, status, config, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      organizationId,
      payload.name,
      payload.type,
      payload.status || "draft",
      JSON.stringify(payload.config || {}),
      payload.lastSyncedAt || null,
    ]
  );
  return mapDataSource(res.rows[0]);
}

export async function selectDataSources(organizationId) {
  const res = await query(
    `SELECT *
     FROM data_sources
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapDataSource);
}

export async function insertDashboard(organizationId, payload, userId) {
  const res = await query(
    `INSERT INTO dashboards (organization_id, title, description, ai_summary, layout, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      organizationId,
      payload.title,
      payload.description || null,
      payload.aiSummary || null,
      JSON.stringify(payload.layout || []),
      payload.status || "draft",
      userId,
    ]
  );
  return mapDashboard(res.rows[0]);
}

export async function selectDashboards(organizationId) {
  const res = await query(
    `SELECT *
     FROM dashboards
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapDashboard);
}

export async function insertWidget(dashboardId, payload) {
  const res = await query(
    `INSERT INTO dashboard_widgets (dashboard_id, data_source_id, title, visualization, config, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      dashboardId,
      payload.dataSourceId || null,
      payload.title,
      payload.visualization,
      JSON.stringify(payload.config || {}),
      JSON.stringify(
        payload.position || {
          x: 0,
          y: 0,
          w: 6,
          h: 4,
        }
      ),
    ]
  );
  return mapWidget(res.rows[0]);
}

export async function selectWidgets(dashboardId) {
  const res = await query(
    `SELECT *
     FROM dashboard_widgets
     WHERE dashboard_id = $1
     ORDER BY created_at ASC`,
    [dashboardId]
  );
  return res.rows.map(mapWidget);
}

export async function insertServiceProfile(organizationId, payload) {
  const res = await query(
    `INSERT INTO service_profiles (organization_id, name, service_type, status, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      organizationId,
      payload.name,
      payload.serviceType,
      payload.status || "draft",
      JSON.stringify(payload.config || {}),
    ]
  );
  return mapServiceProfile(res.rows[0]);
}

export async function selectServiceProfiles(organizationId) {
  const res = await query(
    `SELECT *
     FROM service_profiles
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapServiceProfile);
}

export async function upsertDashboardServiceBinding(dashboardId, payload) {
  const res = await query(
    `INSERT INTO dashboard_service_bindings (dashboard_id, service_profile_id, scope)
     VALUES ($1, $2, $3)
     ON CONFLICT (dashboard_id, service_profile_id) DO UPDATE SET scope = EXCLUDED.scope
     RETURNING id, dashboard_id, service_profile_id, scope, created_at`,
    [dashboardId, payload.serviceProfileId, payload.scope || null]
  );
  const row = res.rows[0];
  const serviceRes = await query(`SELECT * FROM service_profiles WHERE id = $1`, [
    payload.serviceProfileId,
  ]);
  return mapBinding({
    ...row,
    organization_id: serviceRes.rows[0].organization_id,
    service_name: serviceRes.rows[0].name,
    service_type: serviceRes.rows[0].service_type,
    service_status: serviceRes.rows[0].status,
    service_config: serviceRes.rows[0].config,
    service_created_at: serviceRes.rows[0].created_at,
    service_updated_at: serviceRes.rows[0].updated_at,
  });
}

export async function selectDashboardServiceBindings(dashboardId) {
  const res = await query(
    `SELECT b.*, sp.organization_id, sp.name AS service_name, sp.service_type, sp.status AS service_status,
            sp.config AS service_config, sp.created_at AS service_created_at, sp.updated_at AS service_updated_at
     FROM dashboard_service_bindings b
     JOIN service_profiles sp ON sp.id = b.service_profile_id
     WHERE b.dashboard_id = $1
     ORDER BY b.created_at DESC`,
    [dashboardId]
  );
  return res.rows.map(mapBinding);
}

export async function insertRecommendation(organizationId, userId, prompt, result) {
  const res = await query(
    `INSERT INTO ai_recommendations (organization_id, requested_by, prompt, result, status, completed_at)
     VALUES ($1, $2, $3, $4, 'completed', NOW())
     RETURNING *`,
    [organizationId, userId, JSON.stringify(prompt), JSON.stringify(result)]
  );
  return mapRecommendation(res.rows[0]);
}

export async function selectRecommendations(organizationId) {
  const res = await query(
    `SELECT *
     FROM ai_recommendations
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows.map(mapRecommendation);
}
