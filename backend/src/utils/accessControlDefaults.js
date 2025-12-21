export const buildDefaultAccessControl = () => ({
  accessMode: "restricted",
  rolePermissions: [
    {
      role: "Owner",
      permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true },
    },
    {
      role: "Admin",
      permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true },
    },
    {
      role: "Manager",
      permissions: { view: true, create: true, edit: true, delete: false, manageAccess: false },
    },
    {
      role: "Analyst",
      permissions: { view: true, create: false, edit: false, delete: false, manageAccess: false },
    },
    {
      role: "Viewer",
      permissions: { view: true, create: false, edit: false, delete: false, manageAccess: false },
    },
  ],
  userAssignments: [],
});
