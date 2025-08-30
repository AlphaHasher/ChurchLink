export type AccountPermissions = {
  _id: string;
  name: string;
  admin: boolean;
  finance: boolean;
  website_management: boolean;
  event_management: boolean;
  page_management: boolean;
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
  website_management: "Site Management",
  event_management: "Event Moderator",
  page_management: "Page Moderator",
  finance: "Financial Access",
  media_management: "Manage Media Content",
};

// Remove the 'name' key from permissionLabels
const { name, ...remainingPermissionLabels } = permissionLabels;

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...remainingPermissionLabels,  // Merging the remaining permissionLabels without 'name'
};


