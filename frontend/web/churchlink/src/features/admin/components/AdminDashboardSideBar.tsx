import { useMemo, useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart2,
  Home,
  Shield,
  User,
  Folder,
  Loader2,
  CalendarFold,
  BookOpen,
  Bell,
  DollarSign,
} from "lucide-react";
import { processStrapiRedirect } from "@/helpers/StrapiInteraction";
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

const AdminDashboardSideBar = () => {
  const location = useLocation();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

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
      { title: "Media", url: "/admin/webbuilder/media" },
      { title: "Settings", url: "/admin/webbuilder/settings" },
    ],
    []
  );

  const handleMediaRedirect = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoadingKey("media");
    try {
      await processStrapiRedirect();
    } finally {
      setLoadingKey(null);
    }
  };

  const items: Item[] = [
    { title: "Home", url: "/", icon: Home },
    { title: "Dashboard", url: "/admin", icon: BarChart2 },
    { title: "Manage Users", url: "/admin/users", icon: User },
    { title: "Permissions", url: "/admin/permissions", icon: Shield },
    { title: "Web Builder", icon: Folder, children: webBuilderChildren },
    { title: "Mobile UI", url: "/admin/mobile-ui-tab", icon: Shield },
    { title: "Media Library", icon: Folder, onClick: handleMediaRedirect, loadingKey: "media" },
    { title: "Events", url: "/admin/events", icon: CalendarFold },
    { title: "Forms", icon: Folder, children: [
      { title: "Manage Forms", url: "/admin/forms/manage-forms" },
      { title: "Form Builder", url: "/admin/forms/form-builder" },
    ] },
    { title: "Sermons Manager", url: "/admin/sermons", icon: BookOpen },
    { title: "Bible Plans", icon: BookOpen, children: [
      { title: "Manage Plans", url: "/admin/bible-plans/manage-plans" },
      { title: "Plan Builder", url: "/admin/bible-plans/plan-builder" },
    ] },
    { title: "Finance", url: "/admin/finance", icon: DollarSign },
    { title: "Notifications", url: "/admin/notifications", icon: Bell },
  ];

  return (
    <Sidebar collapsible="icon">
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
                          {item.loadingKey && loadingKey === item.loadingKey ? "Loading..." : item.title}
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

      <SidebarRail />

      <SidebarFooter>
        <ProfilePill className="mx-2 mb-2" />
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminDashboardSideBar;
