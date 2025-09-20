import { useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart2, Settings, LogOut, Home, Shield, User, Folder, Loader2, CalendarFold, BookOpen, Bell, DollarSign } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { processStrapiRedirect } from "@/helpers/StrapiInteraction";
import {
  Sidebar as ShSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/components/ui/sidebar";
import { useAuth } from "@/features/auth/hooks/auth-context";

const AdminDashboardSideBar = () => {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const handleMediaRedirect = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    await processStrapiRedirect();
    setLoading(false);
  };

  const isActive = (path?: string) => !!path && (location.pathname === path || location.pathname.startsWith(path + "/"));

  type Item = { title: string; url?: string; icon: ComponentType<{ className?: string }>; onClick?: (e: React.MouseEvent) => void; loadingKey?: string };

  const items: Item[] = [
    { title: "Home", url: "/pages/home", icon: Home },
    { title: "Dashboard", url: "/admin", icon: BarChart2 },
    { title: "Manage Users", url: "/admin/users", icon: User },
    { title: "Permissions", url: "/admin/permissions", icon: Shield },
    { title: "Media Library", icon: Folder, onClick: handleMediaRedirect, loadingKey: "media" },
    { title: "Events", url: "/admin/events", icon: CalendarFold },
    { title: "Forms", url: "/admin/forms/form-builder", icon: Folder },
    { title: "Bible Plan Manager", url: "/admin/bible-plan-manager", icon: BookOpen },
    { title: "Web Builder", url: "/admin/webbuilder", icon: Folder },
    { title: "Finance", url: "/admin/finance", icon: DollarSign },
    { title: "Notifications", url: "/admin/notifications", icon: Bell },
    { title: "Settings", url: "/admin/settings", icon: Settings },
    { title: "Logout", icon: LogOut, onClick: () => signOut(auth) },
  ];

  return (
      <ShSidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.onClick ? (
                      <SidebarMenuButton onClick={item.onClick} aria-disabled={item.loadingKey ? loading : undefined} isActive={isActive(item.url)}>
                        {item.loadingKey && loading ? <Loader2 className="animate-spin" /> : <item.icon />}
                        <span>{item.loadingKey && loading ? "Loading..." : item.title}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link to={item.url!}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 p-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="truncate max-w-[12rem]">{user?.email ?? "You're not supposed to be here"}</span>
            </div>
            <div className="flex items-center gap-2">
              <SidebarMenuButton asChild>
                <Link to="/admin/settings"><Settings /><span className="sr-only">Settings</span></Link>
              </SidebarMenuButton>
              <SidebarMenuButton onClick={() => signOut(auth)}>
                <LogOut /><span className="sr-only">Logout</span>
              </SidebarMenuButton>
            </div>
          </div>
        </SidebarFooter>
      </ShSidebar>
  );
};

export default AdminDashboardSideBar;