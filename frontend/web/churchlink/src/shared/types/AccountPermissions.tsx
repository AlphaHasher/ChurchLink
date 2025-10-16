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
  finance: boolean;
  bulletin_editing: boolean;
};


export type PermMask = Omit<AccountPermissions, 'name' | '_id'>;

export type PermComp = {
  status: string;
  roles: string;
} & PermMask;

export const permissionLabels: Record<string, string> = {
  admin: "Administrator",
  permissions_management: "Permissions Manager",
  layout_management: "Site Layout Manager",
  event_editing: "Event Editor",
  event_management: "Event Manager",
  sermon_editing: "Sermon Editor",
  media_management: "Media Library Manager",
  finance: "Finance Manager",
  bulletin_editing: "Bulletin Editor",
};

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...permissionLabels,
};


