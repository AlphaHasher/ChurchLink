export type AccountPermissions = {
  name: string;
  isAdmin: boolean;
  manageWholeSite: boolean;
  editAllEvents: boolean;
  editAllPages: boolean;
  accessFinances: boolean;
  manageNotifications: boolean;
  manageMediaContent: boolean;
  manageBiblePlan: boolean;
  manageUserPermissions: boolean;
};


// Create a type "Perm Mask", it masks AccountPermissions to ONLY have the permissions themselves
// Thus the type is only the perm bools.
export type PermMask = Omit<AccountPermissions, 'name'>;

export type PermComp = {
  status: string;
  roles: string;
} & PermMask;

export const permissionLabels: Record<string, string> = {
  name: "Permission Name",
  isAdmin: "Administrator",
  manageWholeSite: "Site Management",
  editAllEvents: "Event Moderator",
  editAllPages: "Page Moderator",
  accessFinances: "Financial Access",
  manageNotifications: "Notification Management",
  manageMediaContent: "Manage Media Content",
  manageBiblePlan: "Manage Bible Plan",
  manageUserPermissions: "Manage User Permissions",
};

// Remove the 'name' key from permissionLabels
const { name, ...remainingPermissionLabels } = permissionLabels;

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...remainingPermissionLabels,  // Merging the remaining permissionLabels without 'name'
};


