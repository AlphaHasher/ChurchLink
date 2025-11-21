import { useState, useEffect } from "react";
import { ChevronDown, User, Shield, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { useLanguage } from "@/provider/LanguageProvider";
import { useLocalize } from "@/shared/utils/localizationUtils";
import api from "@/api/api";
import { auth, signOut } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import AvatarImg from "./AvatarImg";
import HeaderDove from "@/assets/HeaderDove";

// Define interfaces for header data types
interface HeaderLink {
  titles: Record<string, string>;
  url?: string;
  slug?: string;
  is_hardcoded_url?: boolean;
  visible?: boolean;
  type?: string;
}

interface HeaderDropdown {
  titles: Record<string, string>;
  items: HeaderLink[];
  visible?: boolean;
  type?: string;
}

type HeaderItem = HeaderLink | HeaderDropdown;

interface Header {
  items: HeaderItem[];
}

export function AppSidebar() {
  const [headerItems, setHeaderItems] = useState<HeaderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<string>>(new Set());
  const [isMod, setIsMod] = useState(false);
  const { setOpen } = useSidebar();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const localize = useLocalize();
  const navigate = useNavigate();

  // Helper: normalize slug/url to a single leading slash path
  const normalizePath = (path?: string) => {
    if (!path) return "/";
    let p = path.trim();
    if (p === "home" || p === "") return "/";
    if (!p.startsWith("/")) p = `/${p}`;
    p = p.replace(/^\/+/, "/");
    return p;
  };

  // Helper function to handle navigation
  const handleNavigation = (item: HeaderLink) => {
    setOpen(false); // Close sidebar on navigation
    
    if (item.is_hardcoded_url && item.url) {
      window.location.href = item.url;
      return;
    }

    const target = item.slug ? normalizePath(item.slug) : (item.url ? normalizePath(item.url) : "/");
    navigate(target);
  };

  // Helper to get localized label
  const getLabelFromTitles = (t?: Record<string, string>, fallback?: string) => {
    const direct = t?.[locale];
    if (direct && String(direct).trim()) return direct;

    const base = (t?.en ?? fallback ?? "").toString();

    if (locale && locale !== "en" && base) {
      const translated = localize(base);
      if (translated && String(translated).trim()) return translated;
    }

    return base;
  };

  // Toggle dropdown expansion
  const toggleDropdown = (title: string) => {
    setExpandedDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

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

  useEffect(() => {
    const checkIfMod = async () => {
      if (user) {
        try {
          const res = await api.get("/v1/users/check-mod");
          setIsMod(res.data['success']);
        } catch (error) {
          console.error("Error checking if user is mod:", error);
          setIsMod(false);
        }
      } else {
        setIsMod(false);
      }
    };

    checkIfMod();
  }, [user]);

  return (
    <Sidebar side="right" variant="sidebar" className="lg:hidden! z-[100]">
      <SidebarContent className="bg-slate-900 w-full max-w-[100vw] relative z-[100] overflow-x-hidden">
        {/* Logo Section at Top */}
        <div className="flex items-center justify-center py-4 px-4 border-b border-white/10">
          <Link to="/" onClick={() => setOpen(false)} className="hover:opacity-80 transition-opacity">
            <HeaderDove className="w-48 h-20" />
          </Link>
        </div>
        
        <SidebarGroup>
          <SidebarGroupContent className="pt-4 px-2">
            <SidebarMenu className="gap-1">
              {/* Auth-aware Profile Dropdown */}
              {!loading && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] px-4 py-3 justify-between font-[Montserrat]! transition-all duration-200 rounded-none h-auto! min-h-[3rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                    onClick={() => {
                      if (!user) {
                        navigate("/auth/login");
                        setOpen(false);
                      } else {
                        toggleDropdown("profile");
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {user ? (
                        <Avatar className="size-6 rounded-full flex-shrink-0">
                          <AvatarImg
                            user={{
                              id: user?.uid,
                              google_uuid: user?.uid,
                              url_picture: user?.photoURL || undefined,
                              displayName: user?.displayName || undefined,
                              email: user?.email || undefined
                            }}
                            className="size-full rounded-full object-cover"
                          />
                          <AvatarFallback className="text-xs">
                            {user?.displayName
                              ?.split(" ")
                              .map((name: string) => name.charAt(0).toUpperCase())
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <User className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="text-[17px] font-medium tracking-wide whitespace-normal! break-words! flex-1">
                        {user ? "Settings" : "Sign in"}
                      </span>
                    </div>
                    {user && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${expandedDropdowns.has("profile") ? "rotate-180" : ""}`}
                      />
                    )}
                  </SidebarMenuButton>
                  
                  {user && expandedDropdowns.has("profile") && (
                    <SidebarMenuSub className="mt-1 mb-1 ml-3 border-l-2 border-white/20 rounded-none">
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] pl-4 py-2.5 text-[16px] font-[Montserrat]! font-medium tracking-wide transition-all duration-200 rounded-none h-auto! min-h-[2.5rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                        >
                          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2">
                            <User className="h-4 w-4 flex-shrink-0 text-white!" />
                            <span className="whitespace-normal! break-words! flex-1">Profile</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      
                      {isMod && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] pl-4 py-2.5 text-[16px] font-[Montserrat]! font-medium tracking-wide transition-all duration-200 rounded-none h-auto! min-h-[2.5rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                          >
                            <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2">
                              <Shield className="h-4 w-4 flex-shrink-0 text-white!" />
                              <span className="whitespace-normal! break-words! flex-1">Admin Panel</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] pl-4 py-2.5 text-[16px] font-[Montserrat]! font-medium tracking-wide transition-all duration-200 rounded-none h-auto! min-h-[2.5rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                          onClick={() => {
                            signOut(auth);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <LogOut className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-normal! break-words! flex-1">Log out</span>
                          </div>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}

              {/* Dynamic Menu Items */}
              {!loading && headerItems
                .filter((item) => item.visible !== false)
                .map((item) => {
                const isDropdown = 'items' in item;
                const isExpanded = expandedDropdowns.has(item.titles.en);

                if (isDropdown) {
                  // Render dropdown with collapsible sub-items
                  const dropdown = item as HeaderDropdown;
                  return (
                    <SidebarMenuItem key={item.titles.en}>
                      <SidebarMenuButton
                        className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] px-4 py-3 justify-between font-[Montserrat]! transition-all duration-200 rounded-none h-auto! min-h-[3rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                        onClick={() => toggleDropdown(item.titles.en)}
                      >
                        <span className="text-[17px] font-medium tracking-wide whitespace-normal! break-words! flex-1">{getLabelFromTitles(dropdown.titles, dropdown.titles.en)}</span>
                        <ChevronDown
                          className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </SidebarMenuButton>
                      
                      {isExpanded && (
                        <SidebarMenuSub className="mt-1 mb-1 ml-3 border-l-2 border-white/20 rounded-none">
                          {dropdown.items
                            .filter((subItem) => subItem.visible !== false)
                            .map((subItem) => (
                              <SidebarMenuSubItem key={`${item.titles.en}-${subItem.titles.en}`}>
                                <SidebarMenuSubButton
                                  className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] pl-4 py-2.5 text-[16px] font-[Montserrat]! font-medium tracking-wide transition-all duration-200 rounded-none h-auto! min-h-[2.5rem] whitespace-normal! break-words! [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                                  onClick={() => handleNavigation(subItem)}
                                >
                                  {getLabelFromTitles(subItem.titles, subItem.titles.en)}
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                } else {
                  // Render regular link
                  const link = item as HeaderLink;
                  return (
                    <SidebarMenuItem key={item.titles.en}>
                      <SidebarMenuButton
                        className="text-white! hover:bg-white/10! hover:text-gray-300! hover:translate-y-[-2px] px-4 py-3 font-[Montserrat]! transition-all duration-200 rounded-none h-auto! min-h-[3rem] [&>span:last-child]:whitespace-normal! [&>span:last-child]:break-words!"
                        onClick={() => handleNavigation(link)}
                      >
                        <span className="text-[17px] font-medium tracking-wide whitespace-normal! break-words!">{getLabelFromTitles(link.titles, link.titles.en)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
