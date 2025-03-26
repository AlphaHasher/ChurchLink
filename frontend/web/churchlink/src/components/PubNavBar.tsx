import HeaderDove from "@/assets/HeaderDove";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "./ui/sidebar";
// import * as DropdownMenu frLogIn, om "@radix-ui/react-dropdown-menu";

// Menu items.
const items = [
  {
    title: "About",
    url: "/pages/about",
  },
  {
    title: "Events",
    url: "/pages/events",
  },
  {
    title: "Ministries",
    url: "/pages/ministries",
  },
  {
    title: "Media",
    url: "/pages/media",
  },
  {
    title: "Giving",
    url: "/pages/giving",
  },
  {
    title: "Weekly Bulletin",
    url: "/pages/weekly-bulletin",
  },
  {
    title: "Русский",
    url: "/pages/russian",
  },
  {
    title: "Login",
    url: "/auth/login",
  },
];

export default function PubNavBar() {

  return (
    <NavigationMenu className="flex p-5 bg-[#000000] justify-between align-center text-white w-full! max-w-screen! max-h-max ">
      <div className="h-38 w-full lg:h-30 flex flex-row justify-between align-center">
        <NavigationMenuList className="flex gap-4 justify-between xl:pl-8 ">
          <Link to="/">
            <HeaderDove className="w-60 xs:w-70 sm:w-90 lg:w-70 lg:h-30 h-40 max-w-[70vw]" />
          </Link>
        </NavigationMenuList>
        <NavigationMenuList className="lg:flex flex-1 gap-4 justify-between h-28 xl:pr-8 align-center">
          {items.map((item) => (
            <NavigationMenuItem
              className=" hidden lg:block hover:bg-gray-400/20! p-2 text-white! hover:text-white  rounded-lg xl:text-xl!"
              key={item.title}
            >
              <Link className="text-white! rounded-lg" to={item.url}>
                {item.title}
              </Link>
            </NavigationMenuItem>
          ))}
          <NavigationMenuItem className="lg:hidden flex justify-end align-center h-2">
            <SidebarTrigger className="bg-black! text-white!  hover:bg-gray-200 text-black [&_svg:not([class*='size-'])]:size-10 lg:hidden!" />
          </NavigationMenuItem>
        </NavigationMenuList>
      </div>
    </NavigationMenu>
  );
}
