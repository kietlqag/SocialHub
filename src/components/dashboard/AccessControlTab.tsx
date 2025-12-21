import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users, Lock, Unlock, UserPlus, X, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  dashboardApi,
  type DashboardAccessMode,
  type DashboardAccessPayload,
  type DashboardRolePermission,
  type DashboardUserAssignment,
} from "../../services/dashboards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import "../../styles/access-control.css";

type DashboardAccessControlProps = {
  dashboardId: string;
  sessionId?: string;
  userId?: string | null;
};

const DEFAULT_ROLE_PERMS: DashboardRolePermission[] = [
  { role: "Owner", permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true } },
  { role: "Admin", permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true } },
  { role: "Manager", permissions: { view: true, create: true, edit: true, delete: false, manageAccess: false } },
  { role: "Analyst", permissions: { view: true, create: false, edit: false, delete: false, manageAccess: false } },
  { role: "Viewer", permissions: { view: true, create: false, edit: false, delete: false, manageAccess: false } },
];

type AccessModeOption = {
  label: string;
  value: DashboardAccessMode;
  description: string;
  icon: React.ElementType;
};

const accessModeOptions: AccessModeOption[] = [
  { label: "Public", value: "public", description: "Any authenticated user can view this dashboard.", icon: Unlock },
  { label: "Restricted", value: "restricted", description: "Only assigned users / roles can access.", icon: ShieldCheck },
  { label: "Private", value: "private", description: "Only the owner (and admins) can access.", icon: Lock },
];

export function AccessControlTab({ dashboardId, sessionId, userId }: DashboardAccessControlProps) {
  const [accessMode, setAccessMode] = useState<DashboardAccessMode>("restricted");
  const [rolePermissions, setRolePermissions] = useState<DashboardRolePermission[]>(DEFAULT_ROLE_PERMS);
  const [roleBaseline, setRoleBaseline] = useState<DashboardRolePermission[]>(DEFAULT_ROLE_PERMS);
  const [assignments, setAssignments] = useState<DashboardUserAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; fullName: string; email: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("Viewer");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [permissionsEditable, setPermissionsEditable] = useState(false);
  const [pendingAccessMode, setPendingAccessMode] = useState<DashboardAccessMode | null>(null);
  const [showAccessModeConfirm, setShowAccessModeConfirm] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<null>(null);

  const fetchAccessControl = async () => {
    try {
      const res = await dashboardApi.getAccessControl(dashboardId, { sessionId, userId: userId || undefined });
      const data = res as DashboardAccessPayload;
      setAccessMode(data.accessMode || "restricted");
      const perms = data.rolePermissions && data.rolePermissions.length ? data.rolePermissions : DEFAULT_ROLE_PERMS;
      setRolePermissions(perms);
      setRoleBaseline(perms);
      setAssignments(data.userAssignments || []);
    } catch (err: any) {
      const message = err?.message || "Failed to load access control. Using defaults.";
      toast.error(message);
      setRolePermissions(DEFAULT_ROLE_PERMS);
      setRoleBaseline(DEFAULT_ROLE_PERMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessControl();
  }, [dashboardId]);

  const handleAccessModeChange = (mode: DashboardAccessMode) => {
    if (mode === accessMode) return;
    setPendingAccessMode(mode);
    setShowAccessModeConfirm(true);
  };

  const handleTogglePermission = (role: string, key: keyof DashboardRolePermission["permissions"]) => {
    if (!permissionsEditable) return;
    const next = rolePermissions.map((r) =>
      r.role === role ? { ...r, permissions: { ...r.permissions, [key]: !r.permissions[key] } } : r,
    );
    setRolePermissions(next);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const res = await dashboardApi.searchUsers(searchTerm.trim());
      setSearchResults(res.users || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Select a user and role");
      return;
    }
    try {
      setSaving(true);
      const res = await dashboardApi.addUserAssignment(
        dashboardId,
        { userId: selectedUserId, role: selectedRole },
        { sessionId, userId: userId || undefined },
      );
      const data = res as DashboardAccessPayload;
      setAssignments(data.userAssignments || []);
      toast.success("User added");
      setShowModal(false);
      setSelectedUserId(null);
      setSearchResults([]);
      setSearchTerm("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAssignmentRole = async (assignmentId: string, role: string) => {
    const previous = assignments;
    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, role } : a)));
    try {
      await dashboardApi.updateUserAssignment(
        dashboardId,
        assignmentId,
        { role },
        { sessionId, userId: userId || undefined },
      );
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role");
      setAssignments(previous);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const previous = assignments;
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    try {
      await dashboardApi.removeUserAssignment(dashboardId, assignmentId, { sessionId, userId: userId || undefined });
      toast.success("User removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove user");
      setAssignments(previous);
    }
  };

  const roleOptions = useMemo(() => rolePermissions.map((r) => r.role), [rolePermissions]);

  const renderToggle = (role: string, key: keyof DashboardRolePermission["permissions"]) => {
    const rolePerm = rolePermissions.find((r) => r.role === role);
    const active = rolePerm?.permissions[key];
    const disabled = !permissionsEditable || saving;
    return (
      <button
        className={`ac-toggle ${active ? "ac-toggle-on" : ""}`}
        onClick={() => handleTogglePermission(role, key)}
        disabled={disabled}
        type="button"
      >
        <span className="ac-toggle-handle" />
      </button>
    );
  };

  const hasUnsavedRoleChanges = useMemo(
    () => JSON.stringify(rolePermissions) !== JSON.stringify(roleBaseline),
    [rolePermissions, roleBaseline],
  );

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const handlePermissionsToggleMode = () => {
    if (!permissionsEditable) {
      setPermissionsEditable(true);
      return;
    }
    if (!hasUnsavedRoleChanges) {
      setPermissionsEditable(false);
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleConfirmSavePermissions = async () => {
    try {
      setSaving(true);
      await dashboardApi.updateRolePermissions(dashboardId, rolePermissions, { sessionId, userId: userId || undefined });
      setRoleBaseline(rolePermissions);
      toast.success("Permissions updated");
      setPermissionsEditable(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update permissions");
    } finally {
      setSaving(false);
      setShowSaveConfirm(false);
    }
  };

  const handleConfirmAccessMode = async () => {
    if (!pendingAccessMode) {
      setShowAccessModeConfirm(false);
      return;
    }
    try {
      setSaving(true);
      await dashboardApi.updateAccessMode(dashboardId, pendingAccessMode, { sessionId, userId: userId || undefined });
      setAccessMode(pendingAccessMode);
      toast.success("Access mode updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update access mode");
      fetchAccessControl();
    } finally {
      setSaving(false);
      setPendingAccessMode(null);
      setShowAccessModeConfirm(false);
    }
  };

  return (
    <div className="acTab">
      <div className="acTabHeader">
        <div>
          <p className="mdMainSubtitle">Control who can access this dashboard</p>
          <h2 className="acTitle">Access control</h2>
        </div>
        <div className="acStatus">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-slate-600">Mode: {accessMode}</span>
        </div>
      </div>

      {loading ? (
        <div className="acSkeleton">Loading access settings...</div>
      ) : (
        <div className="acGrid">
          <div className="acCard">
            <div className="acCardHeader">
              <div>
                <h3 className="acCardTitle">Access mode</h3>
                <p className="acCardSubtitle">Control how this dashboard can be accessed.</p>
              </div>
              <span className="acBadge">{accessMode}</span>
            </div>
            <div className="acRadioGroup">
              {accessModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`acRadio ${accessMode === opt.value ? "active" : ""}`}
                  onClick={() => handleAccessModeChange(opt.value)}
                  disabled={saving}
                >
                  <opt.icon className="w-4 h-4" />
                  <div className="acRadioText">
                    <span>{opt.label}</span>
                    <small>{opt.description}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

            <div className="acCard">
      <div className="acCardHeader">
        <div>
          <h3 className="acCardTitle">Roles & permissions</h3>
          <p className="acCardSubtitle">Define what each role can do in this dashboard.</p>
              </div>
              <button
                className={`acIconBtn ${permissionsEditable ? "primary" : ""}`}
                title={permissionsEditable ? "Save changes" : "Edit permissions"}
                aria-label={permissionsEditable ? "Save changes" : "Edit permissions"}
                onClick={handlePermissionsToggleMode}
              >
                {permissionsEditable ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            </div>
            <div className="acTableWrap">
              <div className="acTable">
                <div className="acTableHead">
                  <div className="acTh role">Role</div>
                  <div className="acTh">View</div>
                  <div className="acTh">Create</div>
                  <div className="acTh">Edit</div>
                  <div className="acTh">Delete</div>
                  <div className="acTh">Manage access</div>
                </div>
                {rolePermissions.map((role) => (
                  <div className="acTr" key={role.role}>
                    <div className="acTd role">
                      <div className="acRolePill">
                        <Users className="w-4 h-4" />
                        <span>{role.role}</span>
                      </div>
                    </div>
                    <div className="acTd">{renderToggle(role.role, "view")}</div>
                    <div className="acTd">{renderToggle(role.role, "create")}</div>
                    <div className="acTd">{renderToggle(role.role, "edit")}</div>
                    <div className="acTd">{renderToggle(role.role, "delete")}</div>
                    <div className="acTd">{renderToggle(role.role, "manageAccess")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="acCard">
            <div className="acCardHeader">
              <div>
                <h3 className="acCardTitle">Users & roles</h3>
                <p className="acCardSubtitle">Assign users to this dashboard.</p>
              </div>
              <button className="acPrimaryBtn" onClick={() => setShowModal(true)}>
                <UserPlus className="w-4 h-4" />
                Add users
              </button>
            </div>
            <div className="acTableWrap">
              <div className="dashboard-access-users-table">
                <div className="acTable">
                  <div className="acTableHead dashboard-access-users-header">
                    <div className="acTh user">User</div>
                    <div className="acTh email">Email</div>
                    <div className="acTh">Role</div>
                    <div className="acTh">Actions</div>
                  </div>
                  {assignments.length ? (
                    assignments.map((user) => (
                      <div className="acTr dashboard-access-users-row" key={user.id}>
                        <div className="acTd user">
                          <div className="acUser">
                            <div className="acAvatar">{(user.fullName || user.email || "?").slice(0, 2).toUpperCase()}</div>
                            <div>
                              <div className="acUserName">{user.fullName || "User"}</div>
                              <div className="acUserMeta">ID: {user.userId}</div>
                            </div>
                          </div>
                        </div>
                          <div className="acTd email">{user.email}</div>
                          <div className="acTd">
                            <Select
                              value={user.role}
                              onValueChange={(val) => {
                            if (val === user.role) return;
                            handleUpdateAssignmentRole(user.id, val);
                            setEditingAssignmentId(null);
                          }}
                          disabled={saving || editingAssignmentId !== user.id}
                        >
                          <SelectTrigger className="mdSelect acSelect" aria-label="Role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="mdSelectContent">
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                          <div className="acTd">
                            <div className="acActionBtns">
                              <button
                            className="acIconBtn warning"
                            title="Edit role"
                            aria-label="Edit role"
                            onClick={() => setEditingAssignmentId(user.id)}
                            disabled={saving}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="acIconBtn danger"
                            title="Remove user"
                            aria-label="Remove user"
                            onClick={() => handleRemoveAssignment(user.id)}
                            disabled={saving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="acEmptyRow">No users assigned yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="acModalOverlay">
          <div className="acModal">
            <div className="acModalHeader">
              <div>
                <p className="mdMainSubtitle">Invite or assign</p>
                <h3 className="acCardTitle">Add users to this dashboard</h3>
              </div>
              <button className="acIconBtn" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="acModalBody">
              <div className="acFormRow">
                <label className="acLabel">Search by email</label>
                <div className="acInputRow">
                  <input
                    className="acInput"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="acGhostBtn" onClick={handleSearch} disabled={searching}>
                    {searching ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>
              <div className="acFormRow">
                <label className="acLabel">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="mdSelect acSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="mdSelectContent">
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="acSearchResults">
                {searchResults.length ? (
                  searchResults.map((user) => (
                    <button
                      key={user.id}
                      className={`acSearchRow ${selectedUserId === user.id ? "active" : ""}`}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <div className="acAvatar sm">{(user.fullName || user.email || "?").slice(0, 2).toUpperCase()}</div>
                      <div className="acUserCol">
                        <div className="acUserName">{user.fullName || "User"}</div>
                        <div className="acUserMeta">{user.email}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="acEmptyRow">Search to find users by email.</p>
                )}
              </div>
            </div>
            <div className="acModalFooter">
              <button className="acGhostBtn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="acPrimaryBtn" onClick={handleAddUser} disabled={saving}>
                {saving ? "Adding..." : "Add to dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="acModalOverlay" onClick={(e) => e.target === e.currentTarget && setShowSaveConfirm(false)}>
          <div className="acModal" role="dialog" aria-modal="true">
            <div className="acModalHeader">
              <div>
                <p className="mdMainSubtitle">Confirm changes</p>
                <h3 className="acCardTitle">Save permission changes?</h3>
                <p className="mdMainSubtitle">You made changes to role permissions. Save and apply them now?</p>
              </div>
              <button className="acIconBtn" onClick={() => setShowSaveConfirm(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="acModalFooter">
              <button className="acGhostBtn" onClick={() => setShowSaveConfirm(false)}>
                Cancel
              </button>
              <button className="acPrimaryBtn" onClick={handleConfirmSavePermissions} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccessModeConfirm && (
        <div className="acModalOverlay" onClick={(e) => e.target === e.currentTarget && setShowAccessModeConfirm(false)}>
          <div className="acModal" role="dialog" aria-modal="true">
            <div className="acModalHeader">
              <div>
                <p className="mdMainSubtitle">Confirm change</p>
                <h3 className="acCardTitle">Change access mode?</h3>
                <p className="mdMainSubtitle">
                  {pendingAccessMode ? `Switch access mode to "${pendingAccessMode}"?` : "Save access mode change?"}
                </p>
              </div>
              <button className="acIconBtn" onClick={() => setShowAccessModeConfirm(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="acModalFooter">
              <button className="acGhostBtn" onClick={() => setShowAccessModeConfirm(false)}>
                Cancel
              </button>
              <button className="acPrimaryBtn" onClick={handleConfirmAccessMode} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
