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
