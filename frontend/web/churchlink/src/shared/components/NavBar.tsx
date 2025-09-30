import { useState, useEffect } from "react";
import HeaderDove from "@/assets/HeaderDove";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/shared/components/ui/navigation-menu";
import { Link, useNavigate } from "react-router-dom";
import ProfileDropDown from "./ProfileDropDown";
import { useAuth } from "@/features/auth/hooks/auth-context";
import api from "@/api/api";
import { ChevronDown } from "lucide-react";

// Define interfaces for header data types
interface HeaderLink {
    title: string;
    russian_title: string;
    url?: string;
    slug?: string;
    is_hardcoded_url?: boolean;
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

interface NavBarProps {
    headerData?: HeaderItem[];
}

export default function NavBar({ headerData }: NavBarProps = {}) {
    const [headerItems, setHeaderItems] = useState<HeaderItem[]>(headerData || []);
    const [loading, setLoading] = useState(!headerData);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const is_russian = false;

    // Helper: normalize slug/url to a single leading slash path
    const normalizePath = (path?: string) => {
        if (!path) return "/";
        let p = path.trim();
        if (p === "home" || p === "") return "/";
        if (!p.startsWith("/")) p = `/${p}`;
        // collapse multiple leading slashes
        p = p.replace(/^\/+/, "/");
        return p;
    };

    // Helper function to handle navigation
    const handleNavigation = (item: HeaderLink) => {
        if (item.is_hardcoded_url && item.url) {
            // For hardcoded URLs, navigate to the URL directly (can be absolute)
            window.location.href = item.url;
            return;
        }

        // Prefer slug when provided; otherwise fallback to url
        const target = item.slug ? normalizePath(item.slug) : (item.url ? normalizePath(item.url) : "/");
        navigate(target);
    };

    useEffect(() => {
        // If headerData is provided as props, use it directly
        if (headerData) {
            setHeaderItems(headerData);
            setLoading(false);
            return;
        }

        // Otherwise fetch from API
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
    }, [headerData]);

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
                            {'url' in item || 'slug' in item ? (
                                <button
                                    className="text-white! font-medium text-[15px]! tracking-wide! hover:text-gray-400! transition-colors duration-200 font-[Montserrat]! bg-transparent border-none cursor-pointer"
                                    onClick={() => handleNavigation(item as HeaderLink)}
                                >
                                    {is_russian ? item.russian_title : item.title}
                                </button>
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
                                            {'items' in item && item.items.filter((subItem: HeaderLink) => subItem.visible !== false).map((subItem: HeaderLink) => (
                                                <button
                                                    key={`${item.title}-${subItem.title}`}
                                                    onClick={() => handleNavigation(subItem)}
                                                    className="block py-2 px-4 rounded-md transition-colors duration-150 hover:bg-neutral-700! text-white! font-medium text-[15px]! tracking-wide! font-[Montserrat]! bg-transparent border-none cursor-pointer text-left w-full"
                                                >
                                                    {is_russian ? subItem.russian_title : subItem.title}
                                                </button>
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
