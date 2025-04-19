import { useState, useEffect } from "react";
import HeaderDove from "@/assets/HeaderDove";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "./ui/sidebar";
import axios from "axios";

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

export default function PubNavBar() {
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
                <NavigationMenuList className="flex gap-4 justify-between xl:pl-8">
                    <Link to="/">
                        <HeaderDove className="w-60 xs:w-70 sm:w-90 lg:w-70 lg:h-30 h-40 max-w-[70vw]" />
                    </Link>
                </NavigationMenuList>
                <NavigationMenuList className="lg:flex flex-wrap gap-4 justify-end h-28 xl:pr-8 align-center">
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
                                <div className="relative"
                                     onMouseEnter={() => setActiveDropdown(item.title)}
                                     onMouseLeave={() => setActiveDropdown(null)}>
                                    <span className="cursor-pointer">{item.title}</span>
                                    <div className={`absolute ${activeDropdown === item.title ? 'block' : 'hidden'} top-full left-0 bg-black p-2 rounded-lg z-10 min-w-[150px]`}>
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
                                </div>
                            )}
                        </NavigationMenuItem>
                    ))}

                    {/* Login button - separate from NavigationMenuItem */}
                    <div className="hidden lg:flex items-center ml-4">
                        <Link
                            to="/auth/login"
                            className="block bg-black hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-medium"
                        >
                            Login
                        </Link>
                    </div>
                </NavigationMenuList>
            </div>
        </NavigationMenu>
    );
}