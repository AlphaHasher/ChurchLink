// AddFooterItem.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,} from "@dnd-kit/core";
import {SortableContext, verticalListSortingStrategy, useSortable, arrayMove,} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FooterItem {
    title: string;
    russian_title: string;
    url: string | null;
    visible?: boolean;
}

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2">
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

const AddFooterItem = () => {
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    // For sections
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [newSectionRussianTitle, setNewSectionRussianTitle] = useState("");
    const [sectionItems, setSectionItems] = useState<FooterItem[]>([]);
    const [tempItemTitle, setTempItemTitle] = useState("");
    const [tempItemRussianTitle, setTempItemRussianTitle] = useState("");
    const [tempItemUrl, setTempItemUrl] = useState("");

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = sectionItems.findIndex((item) => `${item.title}-${item.url}` === active.id);
            const newIndex = sectionItems.findIndex((item) => `${item.title}-${item.url}` === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                setSectionItems(arrayMove(sectionItems, oldIndex, newIndex));
            }
        }
    };

    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSectionTitle) {
            toast.error("Section title is required");
            return;
        }

        if (!newSectionRussianTitle) {
            toast.error("Section russian title is required");
            return;
        }

        try {
            const res = await axios.post("/api/footer/items", {
                "title": newSectionTitle,
                "russian_title": newSectionRussianTitle,
                "items": sectionItems,
                "visible": false,
            });
            if (res) {
                navigate("/admin/webbuilder/footer");
                toast.success("Section added successfully!");
            }
        } catch (err) {
            console.error("Failed to add section:", err);
            toast.error("Failed to add section");
        }
    };

    const handleAddSectionItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempItemTitle || !tempItemRussianTitle) {
            toast.error("Item title and URL are required");
            return;
        }
        setSectionItems([...sectionItems, { title: tempItemTitle, russian_title: tempItemRussianTitle, url: tempItemUrl || null }]);
        setTempItemTitle("");
        setTempItemRussianTitle("");
        setTempItemUrl("");
    };

    const handleRemoveSectionItem = (index: number) => {
        setSectionItems(sectionItems.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add Section</h2>
                <button
                    onClick={() => navigate("/admin/webbuilder/footer")}
                    className="text-white hover:underline"
                >
                    Back to Footer
                </button>
            </div>

            <div className="mb-4">
                <form onSubmit={handleAddSection} className="flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Section Title"
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Russian Title"
                        value={newSectionRussianTitle}
                        onChange={(e) => setNewSectionRussianTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <div className="border rounded p-4 bg-gray-50">
                        <h4 className="font-medium mb-2">Section Items</h4>

                        {sectionItems.length > 0 ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={sectionItems.map((item) => `${item.title}-${item.url}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <ul className="mb-4">
                                        {sectionItems.map((item, index) => (
                                            <SortableItem key={`${item.title}-${item.url}`} id={`${item.title}-${item.url}`}>
                                                <li className="flex justify-between items-center p-2 bg-white border rounded">
                                                    <div>
                                                        <div className="font-medium">{item.title}</div>
                                                        <div className="text-sm text-blue-600">{item.url}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSectionItem(index)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            </SortableItem>
                                        ))}
                                    </ul>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <p className="text-gray-500 italic mb-4">No links</p>
                        )}

                        <div className="border-t pt-3">
                            <h5 className="font-medium mb-2">Add Item to Section</h5>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Title"
                                    value={tempItemTitle}
                                    onChange={(e) => setTempItemTitle(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <input
                                    type="text"
                                    placeholder="Russian Title"
                                    value={tempItemRussianTitle}
                                    onChange={(e) => setTempItemRussianTitle(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <input
                                    type="text"
                                    placeholder="Item URL"
                                    value={tempItemUrl}
                                    onChange={(e) => setTempItemUrl(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddSectionItem}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                                >
                                    Add to Section
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        disabled={sectionItems.length === 0}
                    >
                        Add
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddFooterItem;