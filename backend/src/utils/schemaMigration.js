import { mongoose } from "../mongoose.js";
import { DashboardRecordModel } from "../models/dashboardRecordModel.js";

export async function migrateFieldRenames({ dashboardId, tableKey, renames }) {
  if (!dashboardId || !tableKey || !Array.isArray(renames) || !renames.length) return;
  const objectId = new mongoose.Types.ObjectId(dashboardId);
  for (const rename of renames) {
    const from = rename?.from || rename?.oldKey;
    const to = rename?.to || rename?.newKey;
    if (!from || !to || from === to) continue;
    await DashboardRecordModel.updateMany(
      {
        dashboardId: objectId,
        tableKey,
        [`record.${from}`]: { $exists: true },
      },
      [
        {
          $set: {
            [`record.${to}`]: { $ifNull: [`$record.${to}`, `$record.${from}`] },
            updatedAt: "$$NOW",
          },
        },
        { $unset: [`record.${from}`] },
      ],
    );
  }
}
