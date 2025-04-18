// EditHeaderItem.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface HeaderLink {
    title: string;
    url: string;
    visible?: boolean;
}

interface HeaderDropdown {
    title: string;
    items: HeaderLink[];
    visible?: boolean;
}

type HeaderItem = HeaderLink | HeaderDropdown;

const EditHeaderItem = () => {
    const { title } = useParams<{ title: string }>();
    const navigate = useNavigate();
    const [item, setItem] = useState<HeaderItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [itemType, setItemType] = useState<"link" | "dropdown">("link");

    // For updating simple links
    const [linkTitle, setLinkTitle] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [visible, setVisible] = useState(true);

    // For updating dropdowns
    const [dropdownTitle, setDropdownTitle] = useState("");
    const [dropdownLinks, setDropdownLinks] = useState<HeaderLink[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");

    useEffect(() => {
        fetchItem();
    }, [title]);

    const fetchItem = async () => {
        if (!title) return;

        try {
            setLoading(true);
            const response = await axios.get(`/api/header/items/${title}`);
            const itemData = response.data;
            setItem(itemData);

            if ('url' in itemData) {
                setItemType("link");
                setLinkTitle(itemData.title);
                setLinkUrl(itemData.url);
                setVisible(itemData.visible !== false);
            } else {
                setItemType("dropdown");
                setDropdownTitle(itemData.title);
                setDropdownLinks(itemData.items || []);
                setVisible(itemData.visible !== false);
            }
        } catch (err) {
            console.error("Failed to fetch header item:", err);
            toast.error("Failed to load header item data");
            navigate("/admin/webbuilder/header");
        } finally {
            setLoading(false);
        }
    };
    

    const handleAddDropdownLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLinkTitle || !tempLinkUrl) {
            toast.error("Link title and URL are required");
            return;
        }
        setDropdownLinks([...dropdownLinks, { title: tempLinkTitle, url: tempLinkUrl }]);
        setTempLinkTitle("");
        setTempLinkUrl("");
    };

    if (loading) return <div>Loading item data...</div>;
    if (!item) return <div>Item not found</div>;

    return (
        <div className="max-w-xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Navigation Item</h2>
                <button
                    onClick={() => navigate("/admin/webbuilder/header")}
                    className="text-blue-600 hover:underline"
                >
                    Back to Header
                </button>
            </div>

            <div className="mb-4">
                <label className="flex items-center gap-2 mb-4">
                    <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisible(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span>Visible</span>
                </label>
            </div>

            {itemType === "link" ? (
                <form onSubmit={handleUpdateLink} className="flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Link Title"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Link URL"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                        Update Link
                    </button>
                </form>
            ) : (
                <form onSubmit={handleUpdateDropdown} className="flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Dropdown Title"
                        value={dropdownTitle}
                        onChange={(e) => setDropdownTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />

                    <div className="border rounded p-4 bg-gray-50">
                        <h4 className="font-medium mb-2">Dropdown Links</h4>

                        {dropdownLinks.length > 0 && (
                            <ul className="mb-4">
                                {dropdownLinks.map((link, index) => (
                                    <li
                                        key={index}
                                        className="flex justify-between items-center p-2 bg-white border rounded mb-2"
                                    >
                                        <div>
                                            <div className="font-medium">{link.title}</div>
                                            <div className="text-sm text-blue-600">{link.url}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDropdownLink(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="border-t pt-3">
                            <h5 className="font-medium mb-2">Add Link to Dropdown</h5>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Link Title"
                                    value={tempLinkTitle}
                                    onChange={(e) => setTempLinkTitle(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <input
                                    type="text"
                                    placeholder="Link URL"
                                    value={tempLinkUrl}
                                    onChange={(e) => setTempLinkUrl(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddDropdownLink}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                                >
                                    Add link
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default EditHeaderItem;