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
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import ProfileDropDown from "./ProfileDropDown";
import ProfileDropDownText from "./ProfileDropDownText";
import {
  Calendar,
  FileVideo,
  Heart,
  Home,
  Inbox,
  Languages,
  LogIn,
  Newspaper,
  Search,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

// Menu items.

export type Item = {
  title: string;
  url: string;
  icon: React.ElementType;
};

interface AppSidebarProps {
  items: Item[];
}

const publicItems = [
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
    url: "/auth/login",
    icon: LogIn,
  },
];

const privateItems = [
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
    title: "Profile",
    url: "/profile",
    icon: User,
  },
];

export function AppSidebar() {
  const { setOpen } = useSidebar();
  const [items, setItems] = useState<Item[]>(publicItems);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setItems(privateItems);
    } else {
      setItems(publicItems);
    }
  }, [user]);

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
                <SidebarMenuItem
                  key={item.title}
                  className="hover:bg-transparent! hover:text-white"
                >
                  {item.title === "Profile" ? (
                    <div className="hover:bg-transparent! text-white! hover:bg-white/10! h-22 flex items-center px-4">
                      <item.icon />
                      <ProfileDropDownText className="ml-5 p-0! text-2xl! hover:bg-transparent! hover:text-white border-none bg-transparent!" />
                    </div>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      className="hover:bg-transparent! text-white! hover:bg-white/10! h-22 w-max border-none bg-transparent!"
                    >
                      <Link to={item.url} onClick={() => setOpen(false)}>
                        <item.icon />
                        <span className="text-2xl">
                          {item.title.toUpperCase()}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                  <hr className="border-white/10" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
