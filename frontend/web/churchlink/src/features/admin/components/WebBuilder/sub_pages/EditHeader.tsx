// EditHeader.tsx - Updated to batch changes
import { useState, useEffect } from "react";
import api from "@/api/api";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
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
    russian_title: string;
    url: string;
    visible?: boolean;
}

interface HeaderDropdown {
    title: string;
    russian_title: string;
    items: HeaderLink[];
    visible?: boolean;
}

type HeaderItem = HeaderLink | HeaderDropdown;

interface Header {
    items: HeaderItem[];
}

interface PendingChanges {
    removals: string[];
    visibility: Record<string, boolean>;
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
    const [originalHeader, setOriginalHeader] = useState<Header | null>(null);
    const [header, setHeader] = useState<Header | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
        removals: [],
        visibility: {}
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const navigate = useNavigate();

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        fetchHeader();
    }, []);

    const fetchHeader = async () => {
        try {
            setLoading(true);
            const response = await api.get("/v1/header/items");
            setOriginalHeader(response.data);
            setHeader(response.data);
            // Reset pending changes
            setPendingChanges({ removals: [], visibility: {} });
            setHasUnsavedChanges(false);
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
                setHasUnsavedChanges(true);
            }
        }
    };

    const handleRemoveItem = (title: string) => {
        if (confirm(`Are you sure you want to remove "${title}" from navigation?`)) {
            setPendingChanges(prev => ({
                ...prev,
                removals: [...prev.removals, title]
            }));

            if (header) {
                // Update UI but don't send to backend yet
                const newItems = header.items.filter(item => item.title !== title);
                setHeader({ ...header, items: newItems });
            }

            setHasUnsavedChanges(true);
        }
    };

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
        setPendingChanges(prev => ({
            ...prev,
            visibility: {
                ...prev.visibility,
                [title]: !currentVisibility
            }
        }));

        if (header) {
            // Update UI but don't send to backend yet
            const newItems = header.items.map(item =>
                item.title === title ? { ...item, visible: !currentVisibility } : item
            );
            setHeader({ ...header, items: newItems });
        }

        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!header) return;

        try {
            // Apply all changes at once

            // 1. Process removals
            for (const title of pendingChanges.removals) {
                await api.delete(`/v1/header/${title}`);
            }

            // 2. Apply visibility changes
            for (const [title, visible] of Object.entries(pendingChanges.visibility)) {
                await api.put(`/v1/header/${title}/visibility`, { visible });
            }

            // 3. Save reordering last (after removals are processed)
            const currentTitles = header.items.map(item => item.title);
            await api.put("/v1/header/reorder", { titles: currentTitles });
            toast.success("Navigation changes saved successfully");

            // Refresh data from server
            await fetchHeader();
        } catch (err) {
            console.error("Failed to save navigation changes:", err);
            toast.error("Failed to save changes");
            await fetchHeader(); // Revert to server state on failure
        }
    };

    const handleCancelChanges = () => {
        if (hasUnsavedChanges && confirm("Are you sure you want to discard all pending changes?")) {
            setHeader(originalHeader);
            setPendingChanges({ removals: [], visibility: {} });
            setHasUnsavedChanges(false);
        }
    };

    const getEffectiveVisibility = (item: HeaderItem) => {
        if (item.title in pendingChanges.visibility) {
            return pendingChanges.visibility[item.title];
        }
        return item.visible;
    };

    if (loading) return <div className="p-6 text-center">Loading header data...</div>;

    return (
        <div className="w-full max-w-4xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Header Navigation</h2>
                <button
                    onClick={() => navigate("/admin/webbuilder/header/add")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                    Add Navigation Item
                </button>
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
                                                    {('items' in item) && <span className="ml-2 text-sm text-gray-500">{item.items.length} link{item.items.length == 1 ? "" : "s"}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleChangeVisibility(item.title, !!getEffectiveVisibility(item))}
                                                    className={getEffectiveVisibility(item) ? "text-green-500" : "text-red-500"}
                                                >
                                                    {getEffectiveVisibility(item) ? "Visible" : "Hidden"}
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/admin/webbuilder/header/edit/${item.title}`)}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.title)}
                                                    className="text-red-500 hover:underline"
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

            {header && header.items.length > 0 && (
                <div className="flex gap-4 justify-left mt-4">
                    <button
                        onClick={handleSaveChanges}
                        className={`${hasUnsavedChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'} text-white px-4 py-2 rounded`}
                        disabled={!hasUnsavedChanges}
                    >
                        Save Changes
                    </button>
                    {hasUnsavedChanges && (
                        <button
                            onClick={handleCancelChanges}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EditHeader;