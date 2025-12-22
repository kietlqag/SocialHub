import { v4 as uuidv4 } from "uuid";
import { query } from "../db.js";

type NotifyDashboardCreatedArgs = {
  userId?: string | null;
  dashboardId?: string | null;
  dashboardName?: string | null;
};

export async function notifyDashboardCreated({ userId, dashboardId, dashboardName }: NotifyDashboardCreatedArgs) {
  const id = uuidv4();
  const now = new Date();
  const safeName = dashboardName && dashboardName.trim().length ? dashboardName : "Dashboard";

  const record = {
    id,
    title: "New dashboard created",
    message: `${safeName} was generated successfully.`,
    type: "info",
    metadata: {
      dashboardId: dashboardId || null,
      dashboardName: safeName,
    },
    is_read: false,
    user_id: userId || null,
    created_at: now,
    updated_at: now,
  };

  const sql = `
    INSERT INTO notifications (id, title, message, type, metadata, is_read, user_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
    RETURNING id, title, message, type, metadata, is_read, user_id, created_at, updated_at
  `;

  const params = [
    record.id,
    record.title,
    record.message,
    record.type,
    JSON.stringify(record.metadata),
    record.is_read,
    record.user_id,
    record.created_at,
    record.updated_at,
  ];

  const { rows } = await query(sql, params);
  return rows[0] || record;
}
