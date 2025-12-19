import { Schema } from "mongoose";
import { mongoose } from "../mongoose.js";

const DashboardRecordSchema = new Schema(
  {
    dashboardId: { type: Schema.Types.ObjectId, required: true, index: true },
    tableKey: { type: String, required: true, index: true },
    record: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "dashboard_records",
  },
);

DashboardRecordSchema.index({ dashboardId: 1, tableKey: 1 });

export const DashboardRecordModel =
  mongoose.models.DashboardRecord || mongoose.model("DashboardRecord", DashboardRecordSchema);
