import { useEffect, useMemo, useState } from "react";
import {
  dashboardApi,
  type DashboardAccessMode,
  type DashboardAccessPayload,
  type DashboardRolePermission,
  type DashboardUserAssignment,
} from "../services/dashboards";

export type PermissionKey = "view" | "create" | "edit" | "delete" | "manageAccess";

type UseDashboardPermissionsOptions = {
  userId?: string | null;
  sessionId?: string;
};

const DEFAULT_PERMS: Record<PermissionKey, boolean> = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  manageAccess: true,
};

export const useDashboardPermissions = (dashboardId?: string, opts: UseDashboardPermissionsOptions = {}) => {
  const [accessMode, setAccessMode] = useState<DashboardAccessMode>("restricted");
  const [rolePermissions, setRolePermissions] = useState<DashboardRolePermission[]>([]);
  const [assignments, setAssignments] = useState<DashboardUserAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboardId || !opts.userId) return;
    setLoading(true);
    dashboardApi
      .getAccessControl(dashboardId, { sessionId: opts.sessionId, userId: opts.userId || undefined })
      .then((res) => {
        const data = res as DashboardAccessPayload;
        setAccessMode(data.accessMode);
        setRolePermissions(data.rolePermissions || []);
        setAssignments(data.userAssignments || []);
        setError(null);
      })
      .catch((err: any) => {
        const status = err?.response?.status || err?.status;
        if (status === 403) {
          setError(null);
          return;
        }
        const message = err?.message || "Failed to load permissions";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [dashboardId, opts.sessionId, opts.userId]);

  const currentRole = useMemo(() => {
    if (!opts.userId) return null;
    const matched = assignments.find((a) => a.userId === opts.userId);
    return matched?.role || null;
  }, [assignments, opts.userId]);

  const roleMap = useMemo(() => {
    const map = new Map<string, DashboardRolePermission>();
    rolePermissions.forEach((r) => map.set(r.role.toLowerCase(), r));
    return map;
  }, [rolePermissions]);

  const hasPermission = (permission: PermissionKey) => {
    if (!dashboardId) return false;
    // If no assignments configured, allow everything (owner or default fallback)
    if (!assignments.length) return DEFAULT_PERMS[permission];
    if (permission === "view" && accessMode === "public") return true;
    const roleKey = (currentRole || "").toLowerCase();
    const rolePerm = roleKey ? roleMap.get(roleKey) : undefined;
    if (rolePerm) {
      return !!(rolePerm.permissions as any)?.[permission];
    }
    // No role match -> minimal view if public, else false
    return permission === "view" ? accessMode === "public" : false;
  };

  return {
    accessMode,
    rolePermissions,
    assignments,
    loading,
    error,
    hasPermission,
    refresh: async () => {
      if (!dashboardId) return;
      const data = await dashboardApi.getAccessControl(dashboardId, { sessionId: opts.sessionId, userId: opts.userId || undefined });
      setAccessMode((data as DashboardAccessPayload).accessMode);
      setRolePermissions((data as DashboardAccessPayload).rolePermissions || []);
      setAssignments((data as DashboardAccessPayload).userAssignments || []);
    },
  };
};
