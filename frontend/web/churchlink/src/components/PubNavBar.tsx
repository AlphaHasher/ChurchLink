import Dove from "@/assets/Dove";
import HeaderDove from "@/assets/HeaderDove";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { Link, useLocation } from "react-router-dom";
import { SidebarTrigger } from "./ui/sidebar";
// import * as DropdownMenu frLogIn, om "@radix-ui/react-dropdown-menu";

// Menu items.
const items = [
  {
    title: "About",
    url: "/about",
  },
  {
    title: "Events",
    url: "/events",
  },
  {
    title: "Ministries",
    url: "/ministries",
  },
  {
    title: "Media",
    url: "/media",
  },
  {
    title: "Giving",
    url: "/giving",
  },
  {
    title: "Weekly Bulletin",
    url: "/weekly-bulletin",
  },
  {
    title: "Русский",
    url: "/russian",
  },
  {
    title: "Login",
    url: "/login",
  },
];

export default function PubNavBar() {
  const location = useLocation();

  return (
    <NavigationMenu className="flex p-5 bg-[#000000] justify-between align-center text-white w-full! max-w-screen! max-h-max ">
      <div className="h-38 w-full lg:h-30 flex flex-row justify-between align-center">
        <NavigationMenuList className="flex gap-4 justify-between xl:pl-8 ">
          <Link to="/">
            <HeaderDove className="w-90 h-40 lg:w-70 lg:h-30" />
          </Link>
          <NavigationMenuItem>
            <SidebarTrigger className="bg-black! text-white!  hover:bg-gray-200 text-black [&_svg:not([class*='size-'])]:size-10 lg:hidden!" />
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuList className="flex gap-4 justify-between h-28 xl:pr-8">
          {items.map((item) => (
            <NavigationMenuItem
              className="hover:bg-gray-400/20! p-2 text-white! hover:text-white hidden lg:block rounded-lg xl:text-xl!"
              key={item.title}
            >
              <Link className="text-white! rounded-lg" to={item.url}>
                {item.title}
              </Link>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </div>
    </NavigationMenu>
  );
}
