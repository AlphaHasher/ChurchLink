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

    if (loading) return <div className="h-24 bg-black flex items-center justify-center text-white/50">Loading footer...</div>;
    if (error) return <div className="h-24 bg-black flex items-center justify-center text-red-400">{error}</div>;
    if (!footerData || !footerData.items || footerData.items.length === 0) return null;

    return (
        <footer className="bg-black text-white py-6 px-3">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap -mx-4">
                    {footerData.items.map((section, index) => (
                        section.visible !== false && (
                            <div key={index} className="w-full px-4 mb-8 md:w-1/2 lg:w-1/4" >
                                <h3 className="text-lg font-bold mb-4">{section.title}</h3>
                                <ul className="space-y-2">
                                    {section.items.map((item, itemIndex) => (
                                        item.visible !== false && (
                                            typeof item.url === "string" ? (
                                                <li key={itemIndex}>
                                                    <Link
                                                        to={item.url}
                                                        className="text-gray-300 hover:text-white transition-colors duration-200"
                                                    >
                                                        {item.title}
                                                    </Link>
                                                </li>
                                            ) : (
                                                <div key={itemIndex}>
                                                    <span className="text-gray-300">{item.title}</span>
                                                </div>
                                            )
                                        )
                                    ))}
                                </ul>
                            </div>
                        )
                    ))}
                </div>

                <div className="mt-6 pt-3 text-center text-sm text-gray-400">
                    <p>© {new Date().getFullYear()} SSBC. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;