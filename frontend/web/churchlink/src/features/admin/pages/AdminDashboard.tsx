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
} from "lucide-react";

type Tile = {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
};

const tiles: Tile[] = [
  {
    title: "Users",
    description:
      "View all the users, view/edit all the detailed information associated with a user, assign users permissions, and review and manage memberships.",
    icon: User,
    to: "/admin/users/manage-users",
  },
  {
    title: "Permissions",
    description:
      "View all the various permission roles, create, edit, and delete permission roles. Quickly view all the users that have a particular permission role.",
    icon: Shield,
    to: "/admin/permissions",
  },
  {
    title: "Web Builder",
    description:
      "Create and edit web pages. Manage header sections for navigation, and footer sections for additional style/information display.",
    icon: FileText,
    to: "/admin/webbuilder",
  },
  {
    title: "Media Library",
    description:
      "Upload and organize images, view the current library of assets available.",
    icon: ImageIcon,
    to: "/admin/media-library",
  },
  {
    title: "Mobile UI",
    description:
      "Customize the layout of the mobile app, including which pages are present on the bottom navigation bar and the style of the home page.",
    icon: Smartphone,
    to: "/admin/mobile-ui-tab",
  },
  {
    title: "Events",
    description: "Create and manage upcoming events.",
    icon: CalendarFold,
    to: "/admin/events",
  },
  {
    title: "Forms",
    description: "Build forms and collect submissions.",
    icon: ClipboardList,
    to: "/admin/forms/manage-forms",
  },
  {
    title: "Weekly Bulletin",
    description: "Publish the weekly bulletin.",
    icon: Newspaper,
    to: "/admin/bulletins",
  },
  {
    title: "Sermons Manager",
    description: "Link to your select sermons from YouTube for everyone to view",
    icon: Lectern,
    to: "/admin/sermons",
  },
  {
    title: "Bible Plans",
    description: "Create, edit, and publish reading plans.",
    icon: BookOpen,
    to: "/admin/bible-plans/manage-plans",
  },
  {
    title: "Finance",
    description: "View financial information from donations and purchases",
    icon: Wallet,
    to: "/admin/finance",
  },
  {
    title: "Notifications",
    description: "Send and manage notifications and announcements.",
    icon: Bell,
    to: "/admin/notifications",
  },
];

const AdminDashboard: React.FC = () => {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ title, description, icon: Icon, to }) => (
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
      </section>
    </div>
  );
};

export default AdminDashboard;
