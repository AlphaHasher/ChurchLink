export type AccountPermissions = {
  _id: string;
  name: string;
  admin: boolean;
  permissions_management: boolean;
  layout_management: boolean;
  event_editing: boolean;
  event_management: boolean;
  sermon_editing: boolean;
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
  layout_management: "Site Layout Manager",
  event_editing: "Event Editor",
  event_management: "Event Manager",
  sermon_editing: "Sermon Editor",
  media_management: "Media Library Manager",
};

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...permissionLabels,
};


