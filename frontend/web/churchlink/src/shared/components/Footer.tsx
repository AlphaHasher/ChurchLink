import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/api";
import { useLanguage } from "@/provider/LanguageProvider";
import { useLocalize } from "@/shared/utils/localizationUtils";

interface FooterItem {
    titles: Record<string, string>;
    url?: string | null;
    slug?: string;
    is_hardcoded_url?: boolean;
    visible?: boolean;
}

interface FooterSection {
    titles: Record<string, string>;
    items: FooterItem[];
    visible?: boolean;
}

interface FooterData {
    items: FooterSection[];
}

interface FooterProps {
    footerData?: FooterSection[];
}

// TODO: consider looking into adding a spacer item to be rendered here, for possibility of a right-aligned item

const Footer = ({ footerData: propFooterData }: FooterProps = {}) => {
    const [footerData, setFooterData] = useState<FooterData | null>(propFooterData ? { items: propFooterData } : null);
    const [loading, setLoading] = useState(!propFooterData);
    const { locale } = useLanguage();
    const localize = useLocalize();

    useEffect(() => {
        // If footerData is provided as props, use it directly
        if (propFooterData) {
            setFooterData({ items: propFooterData });
            setLoading(false);
            return;
        }

        // Otherwise fetch from API
        const fetchFooterData = async () => {
            try {
                setLoading(true);
                const response = await api.get("/v1/footer/items");
                setFooterData(response.data);
            } catch (err) {
                console.error("Failed to fetch footer data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchFooterData();
    }, [propFooterData]);

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

    if (loading) return <div className="h-24 bg-neutral-300 flex items-center justify-center text-black/60 font-[Montserrat]!">Loading footer...</div>;
    // Don't show error if footer simply doesn't exist - it's optional
    if (!footerData || !footerData.items || footerData.items.length === 0) return null;

    return (
        <footer className="bg-neutral-300 text-black py-6 px-3 font-[Montserrat]!">
            <div className="px-6 sm:px-12 lg:px-28 pt-8 md:pt-10 lg:pt-12">
                <div className="flex flex-wrap -mx-4">
                    {footerData.items.map((section, index) => (
                        section.visible !== false && (
                            <div key={index} className="w-full px-4 mb-8 md:w-1/2 lg:w-1/4">
                                <h3 className="text-[21px]! font-bold mb-4 font-['Playfair_Display']">{getLabelFromTitles((section as any).titles, (section as any).titles.en)}</h3>
                                <ul className="space-y-2">
                                    {section.items.map((item, itemIndex) => {
                                        // Determine the link destination
                                        let linkTo: string | null = null;
                                        
                                        if (item.is_hardcoded_url && item.url && item.url.trim() !== "") {
                                            linkTo = item.url;
                                        } else if (!item.is_hardcoded_url && item.slug && item.slug.trim() !== "") {
                                            linkTo = `/${item.slug.replace(/^\/+/g, "")}`;
                                        }
                                        
                                        return item.visible !== false && (
                                            linkTo ? (
                                                <li key={itemIndex}>
                                                    <Link
                                                        to={linkTo}
                                                        className="text-neutral-800 hover:text-black transition-colors duration-200"
                                                    >
                                                        {getLabelFromTitles(item.titles)}
                                                    </Link>
                                                </li>
                                            ) : (
                                                <li key={itemIndex}>
                                                    <span className="text-neutral-800">{getLabelFromTitles(item.titles)}</span>
                                                </li>
                                            )
                                        );
                                    })}
                                </ul>
                            </div>
                        )
                    ))}
                </div>

                <div className="mt-6 pt-3 text-center text-sm text-neutral-700">
                    <p>© {new Date().getFullYear()} SSBC. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
