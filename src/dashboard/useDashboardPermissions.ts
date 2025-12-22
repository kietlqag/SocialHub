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
  isGlobalAdmin?: boolean;
};

const DEFAULT_PERMS: Record<PermissionKey, boolean> = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  manageAccess: false,
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
    const normalize = (val: string | number | null | undefined) => (val === null || val === undefined ? "" : String(val));
    const matched = assignments.find((a) => normalize(a.userId) === normalize(opts.userId));
    return matched?.role || null;
  }, [assignments, opts.userId]);

  const roleMap = useMemo(() => {
    const map = new Map<string, DashboardRolePermission>();
    rolePermissions.forEach((r) => map.set(r.role.toLowerCase(), r));
    return map;
  }, [rolePermissions]);

  const perms = useMemo(() => {
    const empty = { ...DEFAULT_PERMS };
    if (!dashboardId) return empty;

    const roleKey = (currentRole || "").toLowerCase();
    const rolePerm = roleKey ? roleMap.get(roleKey) : undefined;
    const isOwner = roleKey === "owner";

    // Private: only owner or global admin can see
    if (accessMode === "private") {
      if (!(isOwner || opts.isGlobalAdmin)) {
        return { view: false, create: false, edit: false, delete: false, manageAccess: false };
      }
      if (rolePerm) return { ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>;
      return empty;
    }

    // Restricted: must have assignment
    if (accessMode === "restricted") {
      if (!rolePerm) {
        return { view: false, create: false, edit: false, delete: false, manageAccess: false };
      }
      return { ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>;
    }

    // Public: if has assignment -> role perms, else view-only
    if (accessMode === "public") {
      if (rolePerm) return { ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>;
      return { view: true, create: false, edit: false, delete: false, manageAccess: false };
    }

    return empty;
  }, [accessMode, currentRole, dashboardId, opts.isGlobalAdmin, roleMap]);

  const canViewDashboard = useMemo(() => {
    if (!dashboardId) return false;
    if (accessMode === "public") return true;
    if (accessMode === "restricted") return perms.view;
    if (accessMode === "private") return perms.view;
    return false;
  }, [accessMode, dashboardId, perms.view]);

  const hasPermission = (permission: PermissionKey) => !!perms[permission];

  return {
    accessMode,
    rolePermissions,
    assignments,
    loading,
    error,
    perms,
    canViewDashboard,
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
