import { useState, useEffect } from "react";
import axios from "axios";
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

interface FooterItem {
    title: string;
    russian_title: string;
    url: string | null;
    visible?: boolean;
}

interface FooterSection {
    title: string;
    russian_title: string;
    items: FooterItem[];
    visible?: boolean;
}

interface Footer {
    items: FooterSection[];
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

const EditFooter = () => {
    const [originalFooter, setOriginalFooter] = useState<Footer | null>(null);
    const [footer, setFooter] = useState<Footer | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
        removals: [],
        visibility: {}
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const navigate = useNavigate();

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        fetchFooter();
    }, []);

    const fetchFooter = async () => {
        try {
            setLoading(true);
            const response = await axios.get("/api/footer/items");
            setOriginalFooter(response.data);
            setFooter(response.data);
            // Reset pending changes
            setPendingChanges({ removals: [], visibility: {} });
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error("Failed to fetch footer:", err);
            toast.error("Failed to load footer data");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!footer) return;

        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = footer.items.findIndex(item => item.title === active.id);
            const newIndex = footer.items.findIndex(item => item.title === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newItems = arrayMove(footer.items, oldIndex, newIndex);
                setFooter({ ...footer, items: newItems });
                setHasUnsavedChanges(true);
            }
        }
    };

    const handleRemoveItem = (title: string) => {
        if (confirm(`Are you sure you want to remove "${title}"?`)) {
            setPendingChanges(prev => ({
                ...prev,
                removals: [...prev.removals, title]
            }));

            if (footer) {
                // Update UI but don't send to backend yet
                const newItems = footer.items.filter(item => item.title !== title);
                setFooter({ ...footer, items: newItems });
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

        if (footer) {
            // Update UI but don't send to backend yet
            const newItems = footer.items.map(item =>
                item.title === title ? { ...item, visible: !currentVisibility } : item
            );
            setFooter({ ...footer, items: newItems });
        }

        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!footer) return;

        try {
            // Apply all changes at once

            // 1. Process removals
            for (const title of pendingChanges.removals) {
                await axios.delete(`/api/footer/${title}`);
            }

            // 2. Apply visibility changes
            for (const [title, visible] of Object.entries(pendingChanges.visibility)) {
                await axios.put(`/api/footer/${title}/visibility`, { visible });
            }

            // 3. Save reordering last (after removals are processed)
            const currentTitles = footer.items.map(item => item.title);
            await axios.put("/api/footer/reorder", {titles: currentTitles});
            toast.success("Footer changes saved successfully");

            // Refresh data from server
            await fetchFooter();
        } catch (err) {
            console.error("Failed to save footer changes:", err);
            toast.error("Failed to save changes");
            await fetchFooter(); // Revert to server state on failure
        }
    };

    const handleCancelChanges = () => {
        if (hasUnsavedChanges && confirm("Are you sure you want to discard all pending changes?")) {
            setFooter(originalFooter);
            setPendingChanges({ removals: [], visibility: {} });
            setHasUnsavedChanges(false);
        }
    };

    const getEffectiveSectionVisibility = (section: FooterSection) => {
        if (section.title in pendingChanges.visibility) {
            return pendingChanges.visibility[section.title];
        }
        return section.visible;
    };

    if (loading) return <div className="p-6 text-center">Loading footer data...</div>;

    return (
        <div className="w-full max-w-4xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Footer Sections</h2>
                <button
                    onClick={() => navigate("/admin/webbuilder/footer/add")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                    Add Section
                </button>
            </div>

            {/* Current footer items */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Sections</h3>
                {footer && footer.items.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={footer.items.map(item => item.title)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="border rounded divide-y">
                                {footer.items.map((item) => (
                                    <SortableItem key={item.title} id={item.title}>
                                        <li className="flex justify-between items-center p-2">
                                            <div className="flex flex-1">
                                                <div>
                                                    <span className="font-medium">{item.title}</span>
                                                    {('url' in item) && <span className="ml-2 text-sm text-gray-500">{String(item.url)}</span>}
                                                    {('items' in item) && <span className="ml-2 text-sm text-gray-500">{item.items.length} item{item.items.length == 1 ? "" : "s"}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleChangeVisibility(item.title, !!getEffectiveSectionVisibility(item))}
                                                    className={getEffectiveSectionVisibility(item) ? "text-green-500" : "text-red-500"}
                                                >
                                                    {getEffectiveSectionVisibility(item) ? "Visible" : "Hidden"}
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/admin/webbuilder/footer/edit/${item.title}`)}
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
                    <p className="text-gray-500">No sections yet. Click "Add Section" to create one.</p>
                )}
            </div>

            {footer && footer.items.length > 0 && (
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

export default EditFooter;