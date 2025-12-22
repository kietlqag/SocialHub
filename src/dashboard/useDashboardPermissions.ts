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
          setError('forbidden');
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

    // Helper to apply role-specific fallback overrides
    const applyRoleFallback = (p: Record<PermissionKey, boolean>) => {
      if (roleKey === "manager") {
        p.view = true;
        p.create = true;
        p.edit = true;
        // delete remains as returned from DB
      } else if (roleKey === "viewer") {
        p.view = true;
        // other perms remain as returned from DB (default false)
      }
    };

    // Private: only owner or global admin can see
    if (accessMode === "private") {
      if (!(isOwner || opts.isGlobalAdmin)) {
        const finalPerms = { view: false, create: false, edit: false, delete: false, manageAccess: false };
        console.log("DEBUG perms", { roleKey, accessMode, mergedPerms: finalPerms });
        return finalPerms;
      }
      const finalPerms = rolePerm ? ({ ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>) : empty;
      applyRoleFallback(finalPerms);
      console.log("DEBUG perms", { roleKey, accessMode, mergedPerms: finalPerms });
      return finalPerms;
    }

    // Restricted: must have assignment
    if (accessMode === "restricted") {
      let finalPerms: Record<PermissionKey, boolean>;
      if (!rolePerm) {
        finalPerms = { view: false, create: false, edit: false, delete: false, manageAccess: false };
      } else {
        finalPerms = { ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>;
      }
      // Apply role fallback even when rolePerm is missing or misconfigured
      applyRoleFallback(finalPerms);
      console.log("DEBUG perms", { roleKey, accessMode, mergedPerms: finalPerms });
      return finalPerms;
    }

    // Public: if has assignment -> role perms, else view-only
    if (accessMode === "public") {
      let finalPerms: Record<PermissionKey, boolean>;
      if (rolePerm) {
        finalPerms = { ...DEFAULT_PERMS, ...rolePerm.permissions } as Record<PermissionKey, boolean>;
      } else {
        finalPerms = { view: true, create: false, edit: false, delete: false, manageAccess: false };
      }
      // Apply role fallback so managers/viewers get the expected minimum permissions
      applyRoleFallback(finalPerms);
      console.log("DEBUG perms", { roleKey, accessMode, mergedPerms: finalPerms });
      return finalPerms;
    }

    // Fallback
    console.log("DEBUG perms", { roleKey, accessMode, mergedPerms: empty });
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
