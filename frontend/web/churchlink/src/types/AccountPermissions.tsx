export type AccountPermissions = {
  _id: string;
  name: string;
  admin: boolean;
  permissions_management: boolean;
  event_editing: boolean;
  event_management: boolean;
  media_management: boolean;
};


// Create a type "Perm Mask", it masks AccountPermissions to ONLY have the permissions themselves
// Thus the type is only the perm bools.
export type PermMask = Omit<AccountPermissions, 'name' | '_id'>;

export type PermComp = {
  status: string;
  roles: string;
} & PermMask;

export const permissionLabels: Record<string, string> = {
  name: "Permission Name",
  admin: "Administrator",
  permissions_management: "Permissions Manager",
  event_editing: "Event Editor",
  event_management: "Event Manager",
  media_management: "Media Library Manager",
};

// Remove the 'name' key from permissionLabels
const { name, ...remainingPermissionLabels } = permissionLabels;

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...remainingPermissionLabels,  // Merging the remaining permissionLabels without 'name'
};


