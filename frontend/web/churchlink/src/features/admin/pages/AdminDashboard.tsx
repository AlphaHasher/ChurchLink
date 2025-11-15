import * as React from "react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/shared/components/ui/alert";
import useUserPermissions from "@/hooks/useUserPermissions";
import { fetchPermissions } from "@/helpers/PermissionsHelper";
import { AccountPermissions } from "@/shared/types/AccountPermissions";

import {
  ShieldCheck,
  FileText,
  ImageIcon,
  Smartphone,
  ClipboardList,
  Newspaper,
  BookOpen,
  Wallet,
  Bell,
  User,
  Shield,
  CalendarFold,
  Lectern,
  Church,
  AlertTriangle,
} from "lucide-react";

type Tile = {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
  requiresPermission?: string | string[];
};

const tiles: Tile[] = [
  {
    title: "Users",
    description:
      "View all the users, view/edit all the detailed information associated with a user, assign users permissions, and review and manage memberships.",
    icon: User,
    to: "/admin/users/manage-users",
    requiresPermission: "permissions_management",
  },
  {
    title: "Permissions",
    description:
      "View all the various permission roles, create, edit, and delete permission roles. Quickly view all the users that have a particular permission role.",
    icon: Shield,
    to: "/admin/permissions",
    requiresPermission: "permissions_management",
  },
  {
    title: "Ministries",
    description:
      "Create and manage ministry categorizations to apply to events, forms, sermons, and more.",
    icon: Church,
    to: "/admin/ministries",
    requiresPermission: "ministries_management",
  },
  {
    title: "Web Builder",
    description:
      "Create and edit web pages. Manage header sections for navigation, and footer sections for additional style/information display.",
    icon: FileText,
    to: "/admin/webbuilder",
    requiresPermission: "web_builder_management",
  },
  {
    title: "Media Library",
    description:
      "Upload and organize images, view the current library of assets available.",
    icon: ImageIcon,
    to: "/admin/media-library",
    requiresPermission: "media_management",
  },
  {
    title: "Mobile UI",
    description:
      "Customize the layout of the mobile app, including which pages are present on the bottom navigation bar and the style of the home page.",
    icon: Smartphone,
    to: "/admin/mobile-ui-tab",
    requiresPermission: "mobile_ui_management",
  },
  {
    title: "Events",
    description: "Create and manage upcoming events.",
    icon: CalendarFold,
    to: "/admin/events",
    requiresPermission: ["event_management", "event_editing"],
  },
  {
    title: "Forms",
    description: "Build forms and collect submissions.",
    icon: ClipboardList,
    to: "/admin/forms/manage-forms",
    requiresPermission: "forms_management",
  },
  {
    title: "Bulletin Announcements",
    description: "Publish the weekly bulletin.",
    icon: Newspaper,
    to: "/admin/bulletins",
    requiresPermission: "bulletin_editing",
  },
  {
    title: "Sermons Manager",
    description: "Link to your select sermons from YouTube for everyone to view",
    icon: Lectern,
    to: "/admin/sermons",
    requiresPermission: "sermon_editing",
  },
  {
    title: "Bible Plans",
    description: "Create, edit, and publish reading plans.",
    icon: BookOpen,
    to: "/admin/bible-plans/manage-plans",
    requiresPermission: "bible_plan_management",
  },
  {
    title: "Finance",
    description: "View financial information from donations and purchases",
    icon: Wallet,
    to: "/admin/finance",
    requiresPermission: "finance",
  },
  {
    title: "Notifications",
    description: "Send and manage notifications and announcements.",
    icon: Bell,
    to: "/admin/notifications",
    requiresPermission: "notification_management",
  },
];

const AdminDashboard: React.FC = () => {
  const { permissions, loading, error } = useUserPermissions();
  const [allRoles, setAllRoles] = useState<AccountPermissions[]>([]);
  const [unassignedFeatures, setUnassignedFeatures] = useState<string[]>([]);

  // Helper function to check if user has full access
  const hasFullAccess = (requiresPermission?: string | string[]): boolean => {
    if (!requiresPermission) {
      return true; // No permission required - full access
    }

    // If still loading, show as no access temporarily
    if (loading || !permissions) {
      return false;
    }

    // Admin has full access to everything
    if (permissions.admin) {
      return true;
    }

    // Check if user has the required permission(s)
    if (Array.isArray(requiresPermission)) {
      return requiresPermission.some(perm => permissions[perm as keyof typeof permissions]);
    } else {
      return !!permissions[requiresPermission as keyof typeof permissions];
    }
  };

  // Helper function to check if a permission is assigned to any role and get role names
  const getPermissionAssignments = useCallback((requiredPermission: string | string[]): { isAssigned: boolean; assignedRoles: string[] } => {
    if (!requiredPermission) return { isAssigned: true, assignedRoles: [] };

    const permissionsToCheck = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    const assignedRoles: string[] = [];

    allRoles.forEach(role => {
      // Skip admin roles since they have access to everything by default
      if (role.admin) return;

      const hasPermission = permissionsToCheck.some(perm =>
        role[perm as keyof AccountPermissions] === true
      );

      if (hasPermission) {
        assignedRoles.push(role.name);
      }
    });

    return {
      isAssigned: assignedRoles.length > 0,
      assignedRoles
    };
  }, [allRoles]);

  // Check for unassigned features when roles data changes
  useEffect(() => {
    if (allRoles.length > 0) {
      const unassigned: string[] = [];

      tiles.forEach(tile => {
        if (tile.requiresPermission) {
          const permissionInfo = getPermissionAssignments(tile.requiresPermission);
          if (!permissionInfo.isAssigned) {
            unassigned.push(tile.title);
          }
        }
      });

      setUnassignedFeatures(unassigned);
    }
  }, [allRoles, getPermissionAssignments]);

  // Fetch permissions data when component mounts (only for admins)
  useEffect(() => {
    const loadPermissions = async () => {
      if (!loading && permissions && permissions.admin) {
        try {
          const rolesData = await fetchPermissions();
          setAllRoles(rolesData || []);
        } catch (error) {
          console.error('Failed to fetch permissions:', error);
        }
      }
    };

    loadPermissions();
  }, [loading, permissions]);

  // Filter tiles to only show those with full access
  const visibleTiles = tiles.filter(tile => hasFullAccess(tile.requiresPermission));

  // Handle permission load failures with explicit error
  if (!loading && !permissions && error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Alert className="border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
          <AlertTitle className="text-red-800 font-medium dark:text-red-200">
            Permission Load Failed
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            Unable to load your permissions. This may be due to a network issue or server problem.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-destructive/10 text-destructive rounded text-sm hover:bg-destructive/20 border border-destructive/20 dark:bg-destructive/20 dark:text-destructive-foreground"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.href = '/admin'}
                className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80 border border-input dark:bg-muted/30"
              >
                Go to Admin Home
              </button>
            </div>
            <div className="mt-2 text-xs text-red-600 dark:text-red-300">
              Error: {error}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle case where loading finished but permissions is null (silent failure)
  if (!loading && !permissions) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          <AlertTitle className="text-amber-800 font-medium dark:text-amber-200">
            Permission Data Missing
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Your permission data could not be loaded. This may be a temporary issue.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200 border border-amber-300 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-800/30 dark:border-amber-700"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = '/logout'}
                className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm hover:bg-muted/80 border border-input dark:bg-muted/30"
              >
                Sign Out & Back In
              </button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading skeleton while permissions are loading
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="animate-pulse">
          <div className="h-8 bg-muted/60 dark:bg-muted/30 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted/60 dark:bg-muted/30 rounded w-2/3 mb-8"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted/60 dark:bg-muted/30 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-muted/50 to-background p-6 md:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 dark:bg-primary/20">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome to the Admin Panel
            </h1>
            <p className="text-muted-foreground">
              This is your administrative home base. Use the menu on the left to
              jump into an adminsitrative section. Don't know where to go? Feel free to
              use the information below as a guide, and you may click any of the cards to navigate to any of the areas below..
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="secondary">Secure Area</Badge>
              <Badge variant="outline">Staff Only</Badge>
            </div>
          </div>
        </div>

        {/* Subtle gradient flourish */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl"
        />
      </div>

      {/* Tip / Info */}
      <div className="mt-6 space-y-4">
        <Alert>
          <AlertTitle className="font-medium">Quick tip</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            You can bookmark this page as a
            safe landing page. From here, hop to any tool using the sidebar to
            the left, or click any of the cards below.
          </AlertDescription>
        </Alert>

        {/* Unassigned Features Warning - Only show for admins */}
        {permissions?.admin && unassignedFeatures.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            <AlertTitle className="font-medium text-amber-800 dark:text-amber-200">
              Permission Assignment Needed
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              The following features don't have any roles assigned yet: <strong>{unassignedFeatures.join(', ')}</strong>.
              Consider <Link to="/admin/permissions" className="underline hover:no-underline">creating roles</Link> with
              appropriate permissions so staff can access these features.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Action grid */}
      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTiles.map(({ title, description, icon: Icon, to, requiresPermission }) => {
            const permissionInfo = permissions?.admin && requiresPermission
              ? getPermissionAssignments(requiresPermission)
              : { isAssigned: true, assignedRoles: [] };

            const hasNoRoleAssigned = permissions?.admin && requiresPermission && !permissionInfo.isAssigned;
            const hasLimitedRoles = permissions?.admin && requiresPermission && permissionInfo.isAssigned && permissionInfo.assignedRoles.length > 0;

            return (
              <Card
                key={title}
                className={`group transition-colors hover:border-primary/40 relative ${hasNoRoleAssigned ? 'border-amber-200 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200' :
                    hasLimitedRoles ? 'border-blue-200 bg-blue-50/30 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200' : ''
                  }`}
              >
                {/* Invisible overlay link that makes the entire card clickable */}
                <Link
                  to={to}
                  aria-label={`Open ${title}`}
                  className="absolute inset-0 z-10"
                />
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{title}</CardTitle>
                        {hasNoRoleAssigned && (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            No Role
                          </Badge>
                        )}
                        {hasLimitedRoles && (
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700">
                            {permissionInfo.assignedRoles.length === 1 ? '1 Role' : `${permissionInfo.assignedRoles.length} Roles`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {description}
                    {hasNoRoleAssigned && (
                      <span className="block mt-2 text-xs text-amber-600 dark:text-amber-300 font-medium">
                        ⚠️ This feature has no assigned roles. Staff cannot access it yet.
                      </span>
                    )}
                    {hasLimitedRoles && (
                      <span className="block mt-2 text-xs text-blue-600 dark:text-blue-300 font-medium">
                        📋 Available to: <strong>{permissionInfo.assignedRoles.join(', ')}</strong>
                        {permissionInfo.assignedRoles.length === 1 && (
                          <span className="text-blue-500 dark:text-blue-300"> (only this role has access)</span>
                        )}
                      </span>
                    )}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
