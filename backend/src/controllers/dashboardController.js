import { HttpError } from "../utils/httpError.js";
import {
  generateDashboardFields,
  saveDashboard,
  listDashboards,
  removeDashboard,
  generateAndPersistDashboard,
} from "../services/dashboardService.js";

const parseOwner = (req) => ({
  sessionId: req.body.sessionId || req.query.sessionId || null,
  userId: req.body.userId || req.query.userId || null,
});

export async function generateStructure(req, res) {
  const { name, description, type, sessionId, userId } = req.body;
  const owner = {
    sessionId: sessionId || req.query.sessionId || null,
    userId: userId || req.query.userId || null,
  };
  const structure = await generateAndPersistDashboard({ name, type, description, ...owner });
  res.json(structure);
}

export async function createDashboard(req, res) {
  const owner = parseOwner(req);
  const { name, description, fields, widgets, componentCode, tables } = req.body;
  if (!owner.sessionId && !owner.userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  const dashboard = await saveDashboard({ ...owner, name, description, fields, widgets, componentCode, tables });
  res.status(201).json({ dashboard });
}

export async function listDashboard(req, res) {
  const dashboards = await listDashboards(parseOwner(req));
  res.json({ dashboards });
}

export async function deleteDashboard(req, res) {
  const owner = parseOwner(req);
  if (!owner.sessionId && !owner.userId) {
    throw new HttpError(400, "sessionId or userId required");
  }
  await removeDashboard(req.params.id, owner);
  res.json({ success: true });
}
