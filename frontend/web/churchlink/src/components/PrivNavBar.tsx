import { useState, useEffect } from "react";
import HeaderDove from "@/assets/HeaderDove";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "./ui/sidebar";
import ProfileDropDown from "./Main/ProfileDropDown";
import axios from "axios";

// Define interfaces for header data types
interface HeaderLink {
    title: string;
    russian_title: string;
    url: string;
    visible?: boolean;
    type?: string;
}

interface HeaderDropdown {
    title: string;
    russian_title: string;
    items: HeaderLink[];
    visible?: boolean;
    type?: string;
}

type HeaderItem = HeaderLink | HeaderDropdown;

interface Header {
    items: HeaderItem[];
}

export default function PrivNavBar() {
    const [headerItems, setHeaderItems] = useState<HeaderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const is_russian = false

    useEffect(() => {
        const fetchHeaderItems = async () => {
            try {
                const response = await axios.get<Header>("/api/header");
                setHeaderItems(response.data.items);
            } catch (error) {
                console.error("Failed to fetch header items:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHeaderItems();
    }, []);

    return (
        <NavigationMenu className="flex p-5 bg-[#000000] justify-between align-center text-white w-full! max-w-screen! max-h-max">
            <div className="h-38 w-full lg:h-30 flex flex-row justify-between align-center">
                {/* Logo Section */}
                <NavigationMenuList className="flex gap-4 justify-between xl:pl-8">
                    <Link to="/">
                        <HeaderDove className="w-60 xs:w-70 sm:w-90 lg:w-70 lg:h-30 h-40 max-w-[70vw]" />
                    </Link>
                </NavigationMenuList>

                {/* Navigation Items Section */}
                <NavigationMenuList className="lg:flex flex-wrap justify-end h-28 xl:pr-8 align-center">
                    {!loading && headerItems.map((item) => (
                        <NavigationMenuItem
                            className="hidden lg:block hover:bg-gray-400/20! p-2 text-white! hover:text-white rounded-lg xl:text-xl!"
                            key={item.title}
                        >
                            {'url' in item ? (
                                <Link className="text-white! rounded-lg" to={"/" + item.url}>
                                    {is_russian ? item.russian_title : item.title}
                                </Link>
                            ) : (
                                <div className="relative">
                                    <span
                                        className="cursor-pointer"
                                        onMouseEnter={() => setActiveDropdown(item.title)}
                                        onMouseLeave={() => setActiveDropdown(null)}
                                    >
                                        {is_russian ? item.russian_title : item.title}
                                    </span>
                                    {activeDropdown === item.title && (
                                        <div
                                            className="absolute top-full left-0 bg-black p-2 rounded-lg min-w-[150px]"
                                            onMouseEnter={() => setActiveDropdown(item.title)}
                                            onMouseLeave={() => setActiveDropdown(null)}
                                        >
                                            {item.items.filter(subItem => subItem.visible !== false).map(subItem => (
                                                <Link
                                                    key={`${item.title}-${subItem.title}`}
                                                    to={"/" + subItem.url}
                                                    className="block py-1 px-2 hover:bg-gray-700 rounded whitespace-nowrap"
                                                >
                                                    {is_russian ? subItem.russian_title : subItem.title}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </NavigationMenuItem>
                    ))}

                    {/* Mobile Menu Trigger */}
                    <NavigationMenuItem className="lg:hidden flex justify-end align-center h-2">
                        <SidebarTrigger className="bg-black! text-white! hover:bg-gray-200 text-black [&_svg:not([class*='size-'])]:size-10 lg:hidden!" />
                    </NavigationMenuItem>
                    <div className="hidden lg:flex items-center justify-center h-full w-9">
                        <ProfileDropDown className="hover:bg-white/10 transition-colors duration-200 p-0! text-black rounded-full!" />
                    </div>
                </NavigationMenuList>
            </div>
        </NavigationMenu>
    );
}