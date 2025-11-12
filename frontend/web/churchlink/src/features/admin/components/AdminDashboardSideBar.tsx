import { useMemo, useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Shield,
  User,
  Loader2,
  CalendarFold,
  BookOpen,
  Bell,
  FileText,
  Image,
  Smartphone,
  ClipboardList,
  Newspaper,
  Lectern,
  Church,
  Wallet,
  ArrowLeft,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/shared/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import ProfilePill from "@/shared/components/ProfilePill";
import { Skeleton } from '@/shared/components/ui/skeleton';
import useUserPermissions from "@/hooks/useUserPermissions";

const AdminDashboardSideBar = () => {
  const location = useLocation();
  const [loadingKey] = useState<string | null>(null);
  const { permissions, loading } = useUserPermissions();

  const isActive = (path?: string) =>
    !!path && (location.pathname === path || location.pathname.startsWith(path + "/"));

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

  type Item = {
    title: string;
    url?: string;
    icon: ComponentType<{ className?: string }>;
    onClick?: (e: React.MouseEvent) => void | Promise<void>;
    loadingKey?: string;
    children?: { title: string; url: string }[];
    requiresPermission?: string | string[];
  };

  const webBuilderChildren = useMemo(
    () => [
      { title: "Pages", url: "/admin/webbuilder" },
      { title: "Header", url: "/admin/webbuilder/header" },
      { title: "Footer", url: "/admin/webbuilder/footer" },
      { title: "Website Settings", url: "/admin/webbuilder/settings" },
    ],
    []
  );

  const items: Item[] = [
    { title: "Go Back to Main Site", url: "/", icon: ArrowLeft },
    { title: "Admin Panel Home", url: "/admin/", icon: Home },
    {
      title: "Users", 
      url: "/admin/users", 
      icon: User, 
      requiresPermission: "permissions_management",
      children: [
        { title: "Management", url: "/admin/users/manage-users" },
        { title: "Membership Requests", url: "/admin/users/membership-requests" }
      ]
    },

    { 
      title: "Permissions", 
      url: "/admin/permissions", 
      icon: Shield, 
      requiresPermission: "permissions_management" 
    },
    { 
      title: "Ministries", 
      url: "/admin/ministries", 
      icon: Church, 
      requiresPermission: "ministries_management" 
    },
    { 
      title: "Web Builder", 
      icon: FileText, 
      requiresPermission: "web_builder_management",
      children: webBuilderChildren 
    },
    { 
      title: "Media Library", 
      url: "/admin/media-library", 
      icon: Image, 
      requiresPermission: "media_management" 
    },
    {
      title: "Mobile UI", 
      icon: Smartphone, 
      requiresPermission: "mobile_ui_management",
      children: [
        { title: "Tabs", url: "/admin/mobile-ui-tab" },
        { title: "Pages", url: "/admin/mobile-ui-pages" },
      ]
    },
    { 
      title: "Events", 
      url: "/admin/events", 
      icon: CalendarFold, 
      requiresPermission: ["event_management", "event_editing"],
    },
    {
      title: "Forms", 
      icon: ClipboardList, 
      requiresPermission: "forms_management",
      children: [
        { title: "Manage Forms", url: "/admin/forms/manage-forms" },
        { title: "Form Builder", url: "/admin/forms/form-builder" },
      ]
    },
    { 
      title: "Weekly Bulletin", 
      url: "/admin/bulletins", 
      icon: Newspaper, 
      requiresPermission: "bulletin_editing" 
    },
    { 
      title: "Sermons Manager", 
      url: "/admin/sermons", 
      icon: Lectern, 
      requiresPermission: "sermon_editing" 
    },
    {
      title: "Bible Plans", 
      icon: BookOpen, 
      requiresPermission: "bible_plan_management",
      children: [
        { title: "Manage Plans", url: "/admin/bible-plans/manage-plans" },
        { title: "Plan Builder", url: "/admin/bible-plans/plan-builder" },
      ]
    },
    {
      title: "Finance", 
      icon: Wallet, 
      requiresPermission: "finance",
      children: [
        { title: "Overview", url: "/admin/finance" },
        { title: "Refund Management", url: "/admin/finance/refunds" },
      ]
    },
    { 
      title: "Notifications", 
      url: "/admin/notifications", 
      icon: Bell, 
      requiresPermission: "notification_management" 
    },
  ];

  // Filter items to only show those with full access
  const processedItems = items
    .filter(item => hasFullAccess(item.requiresPermission))
    .map(item => ({
      ...item,
      accessLevel: 'full' as const
    }));

  return (
    <Sidebar collapsible="icon" autoCollapse={false} hoverable={false} className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {processedItems.map((item) => {
                return item.children ? (
                  <Collapsible key={item.title} defaultOpen className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child: any) => (
                            <SidebarMenuSubItem key={child.url}>
                              <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                                <Link to={child.url}>{child.title}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    {item.onClick ? (
                      <SidebarMenuButton
                        onClick={item.onClick}
                        aria-disabled={item.loadingKey ? loadingKey === item.loadingKey : undefined}
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        {item.loadingKey && loadingKey === item.loadingKey ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <item.icon />
                        )}
                        <span>
                          {item.loadingKey && loadingKey === item.loadingKey ? <Skeleton className="h-4 w-20 inline-block" /> : item.title}
                        </span>
                      </SidebarMenuButton>
                    ) : item.url ? (
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Disable rail hover interaction entirely */}
      <SidebarRail disabled />
      <SidebarFooter>
        <ProfilePill className="mx-2 mb-2" />
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminDashboardSideBar;
