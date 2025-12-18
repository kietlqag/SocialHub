import { ObjectId } from "mongodb";
import { HttpError } from "../utils/httpError.js";
import {
  generateDashboardFields,
  saveDashboard,
  listDashboards,
  removeDashboard,
  generateAndPersistDashboard,
  addDashboardRecord,
  listDashboardRecords,
} from "../services/dashboardService.js";
import { getSocialhubDb } from "../mongo.js";

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

export async function createDashboardRecord(req, res) {
  const owner = parseOwner(req);
  const { tableKey, record, dashboardId: bodyDashboardId } = req.body;
  const { id: paramId } = req.params;
  const dashboardId = paramId || bodyDashboardId;
  const inserted = await addDashboardRecord({
    dashboardId,
    tableKey,
    record,
    sessionId: owner.sessionId,
    userId: owner.userId,
  });
  res.status(201).json({ record: inserted });
}

export async function getDashboardRecords(req, res) {
  const owner = parseOwner(req);
  const { dashboardId, tableKey } = req.query;
  const records = await listDashboardRecords({
    dashboardId,
    tableKey,
    sessionId: owner.sessionId,
    userId: owner.userId,
  });
  res.json({ records });
}

export async function getDashboardData(req, res) {
  console.log("getDashboardData hit", req.params.id, "query", req.query);
  const owner = parseOwner(req);
  const { from, to } = req.query;
  const db = getSocialhubDb();
  try {
    const dashboards = await db
      .collection("dashboards")
      .find({
        _id: new ObjectId(req.params.id),
        ...(owner.userId ? { userId: owner.userId } : owner.sessionId ? { sessionId: owner.sessionId } : {}),
      })
      .toArray();

    if (!dashboards.length) {
      console.warn("Dashboard not found for data route", req.params.id);
      return res.status(404).json({ message: "Dashboard not found" });
    }

    const dashboard = dashboards[0];
    const widgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
    const dateRange = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const results = [];
    for (const widget of widgets) {
      // eslint-disable-next-line no-await-in-loop
      const result = await evaluateWidget(db, req.params.id, widget, dateRange);
      results.push(result);
    }

    res.json({ dashboardId: req.params.id, widgets: results });
  } catch (err) {
    console.error("getDashboardData error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

function transformFilterToRecord(filter = {}) {
  const transformed = {};
  Object.entries(filter).forEach(([key, value]) => {
    transformed[`record.${key}`] = value;
  });
  return transformed;
}

async function evaluateWidget(db, dashboardId, widget, dateRange) {
  if (!widget || !widget.type) {
    return { id: widget?.id || "unknown", type: widget?.type || "metric", hasData: false, value: 0, series: [] };
  }

  if (widget.type === "metric") {
    return evaluateMetricWidget(db, dashboardId, widget, dateRange);
  }
  if (widget.type === "chart") {
    return evaluateChartWidget(db, dashboardId, widget, dateRange);
  }
  return { id: widget.id, type: widget.type, hasData: false, value: 0, series: [] };
}

async function evaluateMetricWidget(db, dashboardId, widget, dateRange) {
  const collection = db.collection("dashboard_records");
  const match = {
    dashboardId: new ObjectId(dashboardId),
    tableKey: widget.sourceTable,
    ...transformFilterToRecord(widget.filter || {}),
  };

  if (widget.dateField && (dateRange.from || dateRange.to)) {
    match[`record.${widget.dateField}`] = {};
    if (dateRange.from) match[`record.${widget.dateField}`].$gte = dateRange.from;
    if (dateRange.to) match[`record.${widget.dateField}`].$lte = dateRange.to;
  }

  const aggregate = widget.aggregate || "count";
  const pipeline = [{ $match: match }];

  const valueFieldPath = widget.valueField ? `$record.${widget.valueField}` : "$record.value";
  let groupStage = { _id: null };

  if (aggregate === "count") {
    groupStage.value = { $sum: 1 };
  } else if (aggregate === "sum") {
    groupStage.value = { $sum: valueFieldPath };
  } else if (aggregate === "avg") {
    groupStage.value = { $avg: valueFieldPath };
  } else if (aggregate === "min") {
    groupStage.value = { $min: valueFieldPath };
  } else if (aggregate === "max") {
    groupStage.value = { $max: valueFieldPath };
  } else {
    groupStage.value = { $sum: 1 };
  }

  pipeline.push({ $group: groupStage });

  const docs = await collection.aggregate(pipeline).toArray();
  const value = docs.length ? docs[0].value ?? 0 : 0;

  return {
    id: widget.id,
    type: widget.type,
    hasData: Boolean(docs.length),
    value: Number.isFinite(value) ? value : 0,
    series: [],
  };
}

async function evaluateChartWidget(db, dashboardId, widget, dateRange) {
  const collection = db.collection("dashboard_records");
  const aggregate = widget.aggregate || "count";
  const groupBy = widget.groupByField;
  if (!groupBy) {
    return { id: widget.id, type: widget.type, hasData: false, series: [], error: "groupByField required" };
  }

  const baseMatch = {
    dashboardId: new ObjectId(dashboardId),
    tableKey: widget.sourceTable,
    ...transformFilterToRecord(widget.filter || {}),
  };
  if (widget.dateField && (dateRange.from || dateRange.to)) {
    baseMatch[`record.${widget.dateField}`] = {};
    if (dateRange.from) baseMatch[`record.${widget.dateField}`].$gte = dateRange.from;
    if (dateRange.to) baseMatch[`record.${widget.dateField}`].$lte = dateRange.to;
  }

  const buildPipeline = (extraFilter = {}) => {
    const matchStage = { ...baseMatch, ...transformFilterToRecord(extraFilter || {}) };
    const pipeline = [{ $match: matchStage }];
    const groupStage = { _id: `$record.${groupBy}` };
    const valueFieldPath = widget.valueField ? `$record.${widget.valueField}` : "$record.value";

    if (aggregate === "count") groupStage.value = { $sum: 1 };
    else if (aggregate === "sum") groupStage.value = { $sum: valueFieldPath };
    else if (aggregate === "avg") groupStage.value = { $avg: valueFieldPath };
    else if (aggregate === "min") groupStage.value = { $min: valueFieldPath };
    else if (aggregate === "max") groupStage.value = { $max: valueFieldPath };
    else groupStage.value = { $sum: 1 };

    pipeline.push({ $group: groupStage });
    pipeline.push({ $sort: { _id: 1 } });
    return pipeline;
  };

  const series = [];
  const seriesConfig = Array.isArray(widget.seriesConfig) ? widget.seriesConfig : [];
  if (seriesConfig.length) {
    for (const s of seriesConfig) {
      // eslint-disable-next-line no-await-in-loop
      const docs = await collection.aggregate(buildPipeline(s.filter || {})).toArray();
      series.push({
        name: s.name || "Series",
        points: docs.map((doc) => ({ x: doc._id, y: doc.value ?? 0 })),
      });
    }
  } else {
    const docs = await collection.aggregate(buildPipeline()).toArray();
    series.push({
      name: widget.title || "Series",
      points: docs.map((doc) => ({ x: doc._id, y: doc.value ?? 0 })),
    });
  }

  const hasData = series.some((s) => s.points && s.points.length);
  return { id: widget.id, type: widget.type, hasData, series };
}
