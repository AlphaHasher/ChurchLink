import { Calendar, Home, Inbox, Search, LogIn, FileVideo, Heart, Newspaper, Languages } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { Link } from "react-router-dom";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "About",
    url: "/about",
    icon: Inbox,
  },
  {
    title: "Events",
    url: "/events", 
    icon: Calendar,
  },
  {
    title: "Ministries",
    url: "/ministries",
    icon: Search,
  },
  {
    title: "Media",
    url: "/media",
    icon: FileVideo,
  },
  {
    title: "Giving",
    url: "/giving", 
    icon: Heart,
  },
  {
    title: "Weekly Bulletin",
    url: "/weekly-bulletin",
    icon: Newspaper,
  },
  {
    title: "Русский",
    url: "/russian",
    icon: Languages,
  },
  {
    title: "Login",
    url: "/login",
    icon: LogIn,
  },
];

export function AppSidebar() {

  const { setOpen } = useSidebar();

  return (
    <Sidebar side="right" variant="sidebar" className="lg:hidden!">
      <SidebarContent className="bg-[#141414f2] backdrop-blur-sm w-screen relative">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarTrigger className="w-10 h-10 absolute top-5 right-4 z-10 bg-transparent! text-white hover:border-none! hover:outline-[4px] hover:outline-auto hover:outline-[-webkit-focus-ring-color] hover:text-gray-300 [&_svg:not([class*='size-'])]:size-10" />
                <div className="h-20 w-full"></div>
                <hr className="border-white/10" />
              </SidebarMenuItem>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} 
                className="hover:bg-transparent! hover:text-white"
                >
                  <SidebarMenuButton asChild className="hover:bg-transparent! text-white! hover:bg-white/10! h-22 ">
                    <Link to={item.url} onClick={() => setOpen(false)}>
                      <item.icon />
                      <span className="text-2xl">{item.title.toUpperCase()}</span>
                    </Link>
                  </SidebarMenuButton>
                  <hr 
                  className="border-white/10"
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
