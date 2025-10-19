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

const AdminDashboardSideBar = () => {
  const location = useLocation();
  const [loadingKey] = useState<string | null>(null);

  const isActive = (path?: string) =>
    !!path && (location.pathname === path || location.pathname.startsWith(path + "/"));

  type Item = {
    title: string;
    url?: string;
    icon: ComponentType<{ className?: string }>;
    onClick?: (e: React.MouseEvent) => void | Promise<void>;
    loadingKey?: string;
    children?: { title: string; url: string }[];
  };

  const webBuilderChildren = useMemo(
    () => [
      { title: "Pages", url: "/admin/webbuilder" },
      { title: "Header", url: "/admin/webbuilder/header" },
      { title: "Footer", url: "/admin/webbuilder/footer" },
    ],
    []
  );

  const items: Item[] = [
    { title: "Go Back to Main Site", url: "/", icon: ArrowLeft },
    { title: "Admin Panel Home", url: "/admin/", icon: Home },
    {
      title: "Users", url: "/admin/users", icon: User, children: [
        { title: "Management", url: "/admin/users/manage-users" },
        { title: "Membership Requests", url: "/admin/users/membership-requests" }
      ]
    },

    { title: "Permissions", url: "/admin/permissions", icon: Shield },
    { title: "Ministries", url: "/admin/ministries", icon: Lectern },
    { title: "Web Builder", icon: FileText, children: webBuilderChildren },
    { title: "Media Library", url: "/admin/media-library", icon: Image },
    { title: "Mobile UI", url: "/admin/mobile-ui-tab", icon: Smartphone },
    { title: "Events", url: "/admin/events", icon: CalendarFold },
    {
      title: "Forms", icon: ClipboardList, children: [
        { title: "Manage Forms", url: "/admin/forms/manage-forms" },
        { title: "Form Builder", url: "/admin/forms/form-builder" },
      ]
    },
    { title: "Weekly Bulletin", url: "/admin/bulletins", icon: Newspaper },
    { title: "Sermons Manager", url: "/admin/sermons", icon: Lectern },
    {
      title: "Bible Plans", icon: BookOpen, children: [
        { title: "Manage Plans", url: "/admin/bible-plans/manage-plans" },
        { title: "Plan Builder", url: "/admin/bible-plans/plan-builder" },
      ]
    },
    { title: "Finance", url: "/admin/finance", icon: Wallet },
    { title: "Notifications", url: "/admin/notifications", icon: Bell },
  ];

  return (
    <Sidebar collapsible="icon" autoCollapse={false} hoverable={false} className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                item.children ? (
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
                          {item.children.map((child) => (
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
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : null}
                  </SidebarMenuItem>
                )
              ))}
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
