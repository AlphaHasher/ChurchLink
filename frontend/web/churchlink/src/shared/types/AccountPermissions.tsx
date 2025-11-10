export type AccountPermissions = {
  _id: string;
  name: string;
  admin: boolean;
  permissions_management: boolean;
  web_builder_management: boolean;
  mobile_ui_management: boolean;
  event_editing: boolean;
  event_management: boolean;
  sermon_editing: boolean;
  media_management: boolean;
  finance: boolean;
  bulletin_editing: boolean;
  ministries_management: boolean;
  forms_management: boolean;
  bible_plan_management: boolean;
  notification_management: boolean;
};


export type PermMask = Omit<AccountPermissions, 'name' | '_id'>;

export type PermComp = {
  status: string;
  roles: string;
} & PermMask;

export const permissionLabels: Record<string, string> = {
  admin: "Administrator",
  permissions_management: "Permissions Manager",
  web_builder_management: "Web Builder Manager",
  mobile_ui_management: "Mobile UI Manager",
  event_editing: "Event Editor",
  event_management: "Event Manager",
  sermon_editing: "Sermon Editor",
  media_management: "Media Library Manager",
  finance: "Finance Manager",
  bulletin_editing: "Bulletin Editor",
  ministries_management: "Ministries Manager",
  forms_management: "Forms Manager",
  bible_plan_management: "Bible Plan Manager",
  notification_management: "Notification Manager",
};

export const PermCompLabels: Record<string, string> = {
  status: "Since Changes Made",
  roles: "Permission Roles",
  ...permissionLabels,
};


