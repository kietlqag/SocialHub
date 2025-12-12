import { ObjectId } from "mongodb";
import { getSocialhubDb } from "../mongo.js";

const collection = () => getSocialhubDb().collection("dashboards");

const mapDashboard = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  type: doc.type || "",
  description: doc.description || "",
  sessionId: doc.sessionId || null,
  userId: doc.userId || null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const ownerFilter = ({ sessionId, userId }) => {
  if (userId) return { userId };
  if (sessionId) return { sessionId };
  return null;
};

export async function insertDashboard(doc) {
  const now = new Date();
  const payload = {
    name: doc.name,
    type: doc.type || "",
    description: doc.description || "",
    sessionId: doc.sessionId || null,
    userId: doc.userId || null,
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
