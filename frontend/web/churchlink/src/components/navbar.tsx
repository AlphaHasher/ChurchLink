import { NavigationMenu, NavigationMenuItem, NavigationMenuList, NavigationMenuLink } from "@/components/ui/navigation-menu";
import { Link, useLocation } from "react-router-dom";
// import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export default function Navbar() {
  const location = useLocation();

  return (
    <NavigationMenu className="flex p-4 bg-gray-900 justify-between text-white w-full! max-w-screen-lg mx-auto">
      <NavigationMenuList className="flex gap-4">
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link to="/" className={location.pathname === "/" ? "bg-gray-700" : ""}>Home</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link to="/login" className={location.pathname === "/" ? "bg-gray-700" : ""}>Login</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        
        {/* Dropdown Example */}
        {/* <DropdownMenu.Root>
          <DropdownMenu.Trigger className="px-4 py-2 hover:bg-gray-800 rounded">More</DropdownMenu.Trigger>
          <DropdownMenu.Content className="bg-white text-black rounded shadow-lg p-2">
            <DropdownMenu.Item asChild>
              <Link to="/about" className="block px-4 py-2 hover:bg-gray-200">About</Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link to="/contact" className="block px-4 py-2 hover:bg-gray-200">Contact</Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root> */}

      </NavigationMenuList>
    </NavigationMenu>
  );
}
