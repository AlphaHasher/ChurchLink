import { useState, useEffect } from "react";
import HeaderDove from "@/assets/HeaderDove";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/shared/components/ui/navigation-menu";
import { Link } from "react-router-dom";
import ProfileDropDown from "./ProfileDropDown";
import { useAuth } from "@/features/auth/hooks/auth-context";
import api from "@/api/api";
import { ChevronDown } from "lucide-react";

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

export default function NavBar() {
    const [headerItems, setHeaderItems] = useState<HeaderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const { user } = useAuth();

    const is_russian = false;

    useEffect(() => {
        const fetchHeaderItems = async () => {
            try {
                const response = await api.get<Header>("/v1/header");
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
        <NavigationMenu className="flex p-4 bg-[#000000] justify-between align-center text-white w-full! max-w-screen! max-h-max font-[Montserrat]! tracking-wide!">
            <div className="h-30 w-full lg:h-24 flex flex-row justify-between align-center">
                {/* Logo Section */}
                <NavigationMenuList className="flex gap-4 justify-between xl:pl-8">
                    <Link to="/">
                        <HeaderDove className="w-60 xs:w-70 sm:w-90 lg:w-70 lg:h-24 h-32 max-w-[70vw]" />
                    </Link>
                </NavigationMenuList>

                {/* Navigation Items Section */}
                <NavigationMenuList className="lg:flex flex-wrap justify-end h-20 xl:pr-8 align-center">
                    {!loading && headerItems.map((item) => (
                        <NavigationMenuItem
                            key={item.title}
                            className="hidden lg:block px-[20px]! py-[12px]! text-white! font-medium text-[15px]! tracking-wide!
                                       hover:bg-transparent! hover:text-gray-400! transition-colors duration-200 rounded-none!"
                        >
                            {'url' in item ? (
                                <Link
                                    className="text-white! font-medium text-[15px]! tracking-wide! hover:text-gray-400! transition-colors duration-200 font-[Montserrat]!"
                                    to={"/" + item.url}
                                >
                                    {is_russian ? item.russian_title : item.title}
                                </Link>
                            ) : (
                                <div
                                    className="relative"
                                    onMouseEnter={() => setActiveDropdown(item.title)}
                                    onMouseLeave={() => setActiveDropdown(null)}
                                >
                                    <div className="cursor-pointer flex items-center gap-1 text-white! font-medium text-[15px]! tracking-wide! font-[Montserrat]! hover:text-gray-400! transition-colors duration-200">
                                        <span>
                                            {is_russian ? item.russian_title : item.title}
                                        </span>
                                        <ChevronDown
                                            className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === item.title ? "rotate-180" : ""}`}
                                        />
                                    </div>

                                    {/* invisible hover bridge (no layout shift) */}
                                    {activeDropdown === item.title && (
                                        <div className="absolute top-full right-0 h-3 w-full"></div>
                                    )}

                                    {activeDropdown === item.title && (
                                        <div
                                            className="absolute top-full right-0 translate-y-3 bg-neutral-800 p-2 rounded-lg min-w-[180px] shadow-lg"
                                        >
                                            {item.items.filter(subItem => subItem.visible !== false).map(subItem => (
                                                <Link
                                                    key={`${item.title}-${subItem.title}`}
                                                    to={"/" + subItem.url}
                                                    className="block py-2 px-4 rounded-md transition-colors duration-150 hover:bg-neutral-700! text-white! font-medium text-[15px]! tracking-wide! font-[Montserrat]!"
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

                    {/* Auth-specific content */}
                    {user ? (
                        // Authenticated user - show profile dropdown
                        <div className="hidden lg:flex items-center justify-center h-full w-9">
                            <ProfileDropDown className="hover:bg-white/10 transition-colors duration-200 p-0! text-black rounded-full!" />
                        </div>
                    ) : (
                        // Unauthenticated user - show login button
                        <div className="hidden lg:flex items-center ml-4">
                            <Link
                                to="/auth/login"
                                className="block bg-black hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-medium text-[15px]! tracking-wide! font-[Montserrat]!"
                            >
                                Login
                            </Link>
                        </div>
                    )}
                </NavigationMenuList>
            </div>
        </NavigationMenu>
    );
}
