import { Schema } from "mongoose";
import { mongoose } from "../mongoose.js";

const FieldSchema = new Schema(
  {
    id: { type: String },
    key: { type: String, required: true },
    label: { type: String },
    type: { type: String, required: true },
    required: { type: Boolean, default: false },
    visibleInTable: { type: Boolean, default: true },
    options: { type: [String], default: undefined },
    referenceTable: { type: String },
    displayField: { type: String },
    displayTemplate: { type: String },
    displayKey: { type: String },
    labelKey: { type: String },
    allowEditReference: { type: Boolean, default: false },
    system: { type: Boolean, default: false },
    systemField: { type: Boolean, default: false },
    ref: { type: String },
    references: { type: Schema.Types.Mixed },
  },
  { _id: false, strict: false },
);

const DashboardTableSchema = new Schema(
  {
    dashboardId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    purpose: { type: String },
    fields: { type: [FieldSchema], default: [] },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "dashboard_tables",
  },
);

DashboardTableSchema.index({ dashboardId: 1, key: 1 }, { unique: true });

export const DashboardTableModel =
  mongoose.models.DashboardTable || mongoose.model("DashboardTable", DashboardTableSchema);
