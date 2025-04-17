import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface HeaderLink {
    title: string;
    url: string;
}

interface HeaderDropdown {
    title: string;
    items: HeaderLink[];
}

interface Header {
    items: (HeaderLink | HeaderDropdown)[];
}

const EditHeader = () => {
    const [header, setHeader] = useState<Header | null>(null);
    const [loading, setLoading] = useState(true);
    const [newLinkTitle, setNewLinkTitle] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");

    useEffect(() => {
        fetchHeader();
    }, []);

    const fetchHeader = async () => {
        try {
            setLoading(true);
            const response = await axios.get("/api/header");
            setHeader(response.data);
        } catch (err) {
            console.error("Failed to fetch header:", err);
            toast.error("Failed to load header data");
        } finally {
            setLoading(false);
        }
    };

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLinkTitle || !newLinkUrl) {
            toast.error("Title and URL are required");
            return;
        }

        try {
            await axios.post("/api/header/items", {
                type: "link",
                title: newLinkTitle,
                url: newLinkUrl
            });
            toast.success("Link added successfully");
            setNewLinkTitle("");
            setNewLinkUrl("");
            fetchHeader(); // Refresh header data
        } catch (err) {
            console.error("Failed to add link:", err);
            toast.error("Failed to add link");
        }
    };

    const handleRemoveItem = async (title: string) => {
        if (window.confirm(`Are you sure you want to remove "${title}"?`)) {
            try {
                await axios.delete(`/api/header/items/${title}`);
                toast.success("Item removed successfully");
                fetchHeader(); // Refresh header data
            } catch (err) {
                console.error("Failed to remove item:", err);
                toast.error("Failed to remove item");
            }
        }
    };

    if (loading) return <div>Loading header data...</div>;

    return (
        <div className="max-w-xl mx-auto bg-white shadow-md p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">Edit Header Navigation</h2>

            {/* Current header items */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Navigation Items</h3>
                {header?.items?.length ? (
                    <ul className="border rounded p-4">
                        {header.items.map((item: any, index) => (
                            <li key={index} className="flex justify-between items-center p-2 border-b last:border-0">
                                <span>{item.title}</span>
                                <button
                                    onClick={() => handleRemoveItem(item.title)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No navigation items added yet.</p>
                )}
            </div>

            {/* Add new link form */}
            <form onSubmit={handleAddLink} className="border-t pt-4">
                <h3 className="text-lg font-medium mb-2">Add New Link</h3>
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Link Title"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Link URL"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                        Add Link
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditHeader;