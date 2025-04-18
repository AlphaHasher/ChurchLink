// EditHeader.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface Header {
    items: HeaderItem[];
}

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="border-b last:border-0">
            <div className="flex items-center">
                <div {...attributes} {...listeners} className="cursor-grab p-2 mr-2 text-gray-400">
                    &#x2630;
                </div>
                <div className="flex-grow">
                    {children}
                </div>
            </div>
        </div>
    );
};

const EditHeader = () => {
    const [header, setHeader] = useState<Header | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const sensors = useSensors(useSensor(PointerSensor));

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

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!header) return;

        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = header.items.findIndex(item => item.title === active.id);
            const newIndex = header.items.findIndex(item => item.title === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newItems = arrayMove(header.items, oldIndex, newIndex);
                setHeader({ ...header, items: newItems });

                try {
                    await axios.put("/api/header/reorder", newItems);
                    toast.success("Navigation order updated");
                } catch (err) {
                    console.error("Failed to reorder navigation items:", err);
                    toast.error("Failed to update navigation order");
                    fetchHeader(); // Revert to server state on failure
                }
            }
        }
    };

    const handleRemoveItem = async (title: string) => {
        if (confirm(`Are you sure you want to remove "${title}" from navigation?`)) {
            try {
                await axios.delete(`/api/header/items/${title}`);
                toast.success("Navigation item removed successfully");
                fetchHeader(); // Refresh the header data
            } catch (err) {
                console.error("Failed to remove navigation item:", err);
                toast.error("Failed to remove navigation item");
            }
        }
    };

    if (loading) return <div>Loading header data...</div>;

    return (
        <div className="w-full max-w-4xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Header Navigation</h2>
                <Link
                    to="/admin/webbuilder/header/add"
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded"
                >
                    Add Navigation Item
                </Link>
            </div>

            {/* Current header items */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Navigation Items</h3>
                {header && header.items.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={header.items.map(item => item.title)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="border rounded divide-y">
                                {header.items.map((item) => (
                                    <SortableItem key={item.title} id={item.title}>
                                        <li className="flex justify-between items-center p-2">
                                            <div className="flex flex-1">
                                                <div>
                                                    <span className="font-medium">{item.title}</span>
                                                    {('url' in item) && <span className="ml-2 text-sm text-gray-500">{item.url}</span>}
                                                    {('items' in item) && <span className="ml-2 text-sm text-gray-500">{item.items.length} links</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className={`text-sm px-2 py-1 rounded ${
                                                        item.visible !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                    }`}
                                                >
                                                    {item.visible !== false ? "Visible" : "Hidden"}
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/admin/webbuilder/header/edit/${item.title}`)}
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.title)}
                                                    className="text-sm text-red-500 hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </li>
                                    </SortableItem>
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <p className="text-gray-500">No navigation items yet. Click "Add Navigation Item" to create one.</p>
                )}
            </div>

            {/* Save Changes Button */}
            <div className="mt-4 flex justify-start">
                <button
                    onClick={async () => {
                        if (!header) return;
                        try {
                            await axios.put("/api/header/reorder", header.items);
                            toast.success("Navigation changes saved successfully");
                        } catch (err) {
                            console.error("Failed to save changes:", err);
                            toast.error("Failed to save navigation changes");
                        }
                    }}
                    className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default EditHeader;