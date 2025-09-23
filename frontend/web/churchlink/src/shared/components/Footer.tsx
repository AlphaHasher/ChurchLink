import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/api";

interface FooterItem {
    title: string;
    russian_title: string;
    url: string;
    visible?: boolean;
}

interface FooterSection {
    title: string;
    russian_title: string;
    items: FooterItem[];
    visible?: boolean;
}

interface FooterData {
    items: FooterSection[];
}

// TODO: consider looking into adding a spacer item to be rendered here, for possibility of a right-aligned item

const Footer = () => {
    const [footerData, setFooterData] = useState<FooterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFooterData = async () => {
            try {
                setLoading(true);
                const response = await api.get("/v1/footer/items");
                setFooterData(response.data);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch footer data:", err);
                setError("Failed to load footer sections");
            } finally {
                setLoading(false);
            }
        };

        fetchFooterData();
    }, []);

    if (loading) return <div className="h-24 bg-neutral-300 flex items-center justify-center text-black/60 font-[Montserrat]!">Loading footer...</div>;
    if (error) return <div className="h-24 bg-neutral-300 flex items-center justify-center text-red-600 font-[Montserrat]!">{error}</div>;
    if (!footerData || !footerData.items || footerData.items.length === 0) return null;

    return (
        <footer className="bg-neutral-300 text-black py-6 px-3 font-[Montserrat]!">
            <div className="px-6 sm:px-12 lg:px-28 pt-8 md:pt-10 lg:pt-12">
                <div className="flex flex-wrap -mx-4">
                    {footerData.items.map((section, index) => (
                        section.visible !== false && (
                            <div key={index} className="w-full px-4 mb-8 md:w-1/2 lg:w-1/4">
                                <h3 className="text-[21px]! font-bold mb-4 font-['Playfair_Display']">
                                    {section.title}
                                </h3>
                                <ul className="space-y-2">
                                    {section.items.map((item, itemIndex) => (
                                        item.visible !== false && (
                                            typeof item.url === "string" ? (
                                                <li key={itemIndex}>
                                                    <Link
                                                        to={item.url}
                                                        className="text-neutral-800 hover:text-black transition-colors duration-200"
                                                    >
                                                        {item.title}
                                                    </Link>
                                                </li>
                                            ) : (
                                                <div key={itemIndex}>
                                                    <span className="text-neutral-800">{item.title}</span>
                                                </div>
                                            )
                                        )
                                    ))}
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
