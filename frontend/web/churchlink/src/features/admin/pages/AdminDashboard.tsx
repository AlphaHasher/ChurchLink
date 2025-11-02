import * as React from "react";
import { Link } from "react-router-dom";

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
    title: "Weekly Bulletin",
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
  const { permissions, loading } = useUserPermissions();

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

  // Filter tiles to only show those with full access
  const visibleTiles = tiles.filter(tile => hasFullAccess(tile.requiresPermission));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-muted/50 to-background p-6 md:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
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
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
      </div>

      {/* Tip / Info */}
      <div className="mt-6">
        <Alert>
          <AlertTitle className="font-medium">Quick tip</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            You can bookmark this page as a
            safe landing page. From here, hop to any tool using the sidebar to
            the left, or click any of the cards below.
          </AlertDescription>
        </Alert>
      </div>

      {/* Action grid */}
      <section className="mt-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Loading skeleton */}
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted h-9 w-9" />
                    <div className="h-4 bg-muted rounded w-24" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTiles.map(({ title, description, icon: Icon, to }) => (
              <Card
                key={title}
                className="group transition-colors hover:border-primary/40 relative"
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
                    <div>
                      <CardTitle className="text-base">{title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
