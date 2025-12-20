import { initMongoose, mongoose } from "../backend/src/mongoose.js";
import { DashboardTableModel } from "../backend/src/models/dashboardTableModel.js";

const SYSTEM_KEYS = new Set(["id", "_id", "created_at", "updated_at"]);

const normalizeFieldVisibility = (field) => {
  const key = String(field.key || field.fieldName || field.name || "");
  const isSystem = field.system === true || field.systemField === true || SYSTEM_KEYS.has(key);
  const rawVisibleInTable = field.visibleInTable;
  const rawHidden = field.hidden;
  let visible;
  if (rawVisibleInTable !== undefined || rawHidden !== undefined) {
    if (rawHidden === true) visible = false;
    else if (rawVisibleInTable === false) visible = false;
    else visible = true;
  } else {
    visible = isSystem ? false : true;
  }
  return {
    ...field,
    visible,
    visibleInTable: visible,
    hidden: !visible,
  };
};

const updateCollectionFields = async (collection, docs, idSelector) => {
  let docsUpdated = 0;
  let fieldsUpdated = 0;
  for (const doc of docs) {
    const fields = Array.isArray(doc.fields) ? doc.fields : [];
    const normalizedFields = fields.map((f) => normalizeFieldVisibility(f));
    const changed =
      fields.length !== normalizedFields.length ||
      fields.some((f, idx) => {
        const n = normalizedFields[idx];
        return f.visible !== n.visible || f.visibleInTable !== n.visibleInTable || f.hidden !== n.hidden;
      });
    if (!changed) continue;
    const filter = idSelector(doc);
    await collection.updateOne(filter, { $set: { fields: normalizedFields } });
    docsUpdated += 1;
    fieldsUpdated += fields.length;
  }
  return { docsUpdated, fieldsUpdated };
};

async function run() {
  await initMongoose();
  const db = mongoose.connection;

  // Update dashboard_tables
  const tables = await DashboardTableModel.find({}).lean();
  const tablesResult = await updateCollectionFields(
    db.collection("dashboard_tables"),
    tables,
    (doc) => ({ _id: doc._id }),
  );
  console.log(
    `[dashboard_tables] Updated ${tablesResult.docsUpdated} documents (${tablesResult.fieldsUpdated} fields normalized)`,
  );

  // Update dashboards collection if it exists and has fields
  const dashboardsExists = (await db.listCollections({ name: "dashboards" }).toArray()).length > 0;
  if (dashboardsExists) {
    const dashboards = await db
      .collection("dashboards")
      .find({ fields: { $exists: true } })
      .toArray();
    const dashboardsResult = await updateCollectionFields(
      db.collection("dashboards"),
      dashboards,
      (doc) => ({ _id: doc._id }),
    );
    console.log(
      `[dashboards] Updated ${dashboardsResult.docsUpdated} documents (${dashboardsResult.fieldsUpdated} fields normalized)`,
    );
  } else {
    console.log("dashboards collection not found; skipped.");
  }

  await mongoose.connection.close();
  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.connection.close().catch(() => {});
  process.exit(1);
});
