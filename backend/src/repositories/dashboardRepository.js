import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboards");

const mapDashboard = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  type: doc.type || "",
  description: doc.description || "",
  widgets: doc.widgets || [],
  insights: doc.insights || [],
  ui: doc.ui || {},
  sessionId: doc.sessionId || null,
  userId: doc.userId || null,
  samplePreview: doc.samplePreview || null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  accessControl: doc.accessControl || null,
});

const ownerFilter = ({ sessionId, userId }) => {
  if (userId) {
    return {
      $or: [
        { userId },
        {
          $and: [
            { "accessControl.userAssignments.userId": userId },
            { "accessControl.accessMode": { $ne: "private" } },
          ],
        },
      ],
    };
  }
  if (sessionId) return { sessionId };
  return null;
};

export async function insertDashboard(doc) {
  const now = new Date();
  const { buildDefaultAccessControl } = await import("../utils/accessControlDefaults.js");
  const payload = {
    name: doc.name,
    type: doc.type || "",
    description: doc.description || "",
    widgets: Array.isArray(doc.widgets) ? doc.widgets : [],
    insights: Array.isArray(doc.insights) ? doc.insights : [],
    ui: doc.ui || {},
    sessionId: doc.sessionId || null,
    userId: doc.userId || null,
    samplePreview: doc.samplePreview || null,
    accessControl: doc.accessControl || buildDefaultAccessControl(),
    createdAt: now,
    updatedAt: now,
  };
  const res = await collection().insertOne(payload);
  return mapDashboard({ ...payload, _id: res.insertedId });
}

export async function listDashboardsForOwner(params) {
  const filter = ownerFilter(params);
  if (!filter) return [];
  const docs = await collection().find(filter).sort({ createdAt: -1 }).toArray();
  return docs.map(mapDashboard);
}

function requireObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function deleteDashboardForOwner(id, params) {
  const filter = ownerFilter(params);
  if (!filter) return false;
  const objectId = requireObjectId(id);
  if (!objectId) return false;
  const res = await collection().deleteOne({ _id: objectId, ...filter });
  return res.deletedCount > 0;
}

export async function updateDashboardForOwner(id, params, updates) {
  const filter = ownerFilter(params);
  if (!filter) return null;
  const objectId = requireObjectId(id);
  if (!objectId) return null;
  const payload = { ...updates, updatedAt: new Date() };
  const res = await collection().findOneAndUpdate(
    { _id: objectId, ...filter },
    { $set: payload },
    { returnDocument: "after" },
  );
  return res.value ? mapDashboard(res.value) : null;
}

export async function updateDashboardById(id, updates) {
  const objectId = requireObjectId(id);
  if (!objectId) return null;
  const payload = { ...updates, updatedAt: new Date() };
  const res = await collection().findOneAndUpdate({ _id: objectId }, { $set: payload }, { returnDocument: "after" });
  return res.value ? mapDashboard(res.value) : null;
}

export async function findDashboardForOwner(id, params) {
  const filter = ownerFilter(params);
  if (!filter) return null;
  const objectId = requireObjectId(id);
  if (!objectId) return null;
  const doc = await collection().findOne({ _id: objectId, ...filter });
  return doc ? mapDashboard(doc) : null;
}

export async function findDashboardById(id) {
  const objectId = requireObjectId(id);
  if (!objectId) return null;
  const doc = await collection().findOne({ _id: objectId });
  return doc ? mapDashboard(doc) : null;
}
