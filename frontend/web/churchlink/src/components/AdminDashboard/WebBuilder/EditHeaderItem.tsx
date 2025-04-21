import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

// Type definitions
interface BaseHeaderItem {
    title: string;
    russian_title: string;
    visible: boolean;
}

interface LinkItem extends BaseHeaderItem {
    url: string;
    type: "link";
}

interface DropdownItem extends BaseHeaderItem {
    items: LinkItem[];
    type: "dropdown";
}

type HeaderItem = LinkItem | DropdownItem;

// SortableItem component for drag-and-drop
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

const EditHeaderItem: React.FC = () => {
    const { title } = useParams<{ title: string }>();
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    const [item, setItem] = useState<HeaderItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [russianTitle, setRussianTitle] = useState("");
    const [url, setUrl] = useState("");
    const [isDropdown, setIsDropdown] = useState(false);

    // For dropdown items
    const [dropdownItems, setDropdownItems] = useState<LinkItem[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkRussianTitle, setTempLinkRussianTitle] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    useEffect(() => {
        fetchHeaderItem();
    }, [title]);

    const fetchHeaderItem = async () => {
        if (!title) return;

        try {
            setLoading(true);
            const response = await axios.get(`/api/header/${encodeURIComponent(title)}`);
            setItem(response.data);
            setNewTitle(response.data.title);
            setRussianTitle(response.data.russian_title);

            if (response.data.items) {
                setIsDropdown(true);
                setDropdownItems(response.data.items || []);
            } else if (response.data.url){
                setUrl(response.data.url);
                setIsDropdown(false);
            }
        } catch (err) {
            console.error("Failed to fetch header item:", err);
            toast.error("Failed to load navigation item");
            navigate("/admin/webbuilder/header");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!item) return;

        try {
            const updatedItem = isDropdown
                ? {
                    title: newTitle,
                    russian_title: russianTitle,
                    items: dropdownItems,
                }
                : {
                    title: newTitle,
                    russian_title: russianTitle,
                    url,
                };

            const response = await axios.put(`/api/header/items/edit/${title}`, updatedItem);

            if (response.data) {
                toast.success("Navigation item updated successfully");
                navigate("/admin/webbuilder/header");
            }
        } catch (err) {
            console.error("Failed to update navigation item:", err);
            toast.error("Failed to update navigation item");
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setDropdownItems(items => {
                const oldIndex = items.findIndex(item => `${item.title}-${item.url}` === active.id);
                const newIndex = items.findIndex(item => `${item.title}-${item.url}` === over?.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    return arrayMove(items, oldIndex, newIndex);
                }
                return items;
            });
        }
    };

    const handleAddDropdownItem = (e: React.FormEvent) => {
        e.preventDefault();

        if (!tempLinkTitle || !tempLinkRussianTitle || !tempLinkUrl) {
            toast.error("Link title, Russian title, and URL are required");
            return;
        }

        if (editingItemIndex !== null) {
            // Update existing item
            const updatedItems = [...dropdownItems];
            updatedItems[editingItemIndex] = {
                title: tempLinkTitle,
                russian_title: tempLinkRussianTitle,
                url: tempLinkUrl,
                visible: true,
                type: "link"
            };
            setDropdownItems(updatedItems);
            setEditingItemIndex(null);
        } else {
            // Add new item
            setDropdownItems([...dropdownItems, {
                title: tempLinkTitle,
                russian_title: tempLinkRussianTitle,
                url: tempLinkUrl,
                visible: true,
                type: "link"
            }]);
        }

        // Reset form fields
        setTempLinkTitle("");
        setTempLinkRussianTitle("");
        setTempLinkUrl("");
    };

    const handleEditDropdownItem = (index: number) => {
        const item = dropdownItems[index];
        setTempLinkTitle(item.title);
        setTempLinkRussianTitle(item.russian_title);
        setTempLinkUrl(item.url);
        setEditingItemIndex(index);
    };

    const handleRemoveDropdownItem = (index: number) => {
        setDropdownItems(items => items.filter((_, i) => i !== index));
        // If we were editing this item, reset the form
        if (editingItemIndex === index) {
            setTempLinkTitle("");
            setTempLinkRussianTitle("");
            setTempLinkUrl("");
            setEditingItemIndex(null);
        }
    };

    const cancelEditingItem = () => {
        setTempLinkTitle("");
        setTempLinkRussianTitle("");
        setTempLinkUrl("");
        setEditingItemIndex(null);
    };

    if (loading) return <div className="p-6 text-center">Loading item data...</div>;

    return (
        <div className="w-full max-w-4xl mx-auto bg-white shadow-md p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">Edit Navigation Item</h2>

            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-gray-700 mb-1" htmlFor="title">
                        Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-gray-700 mb-1" htmlFor="russianTitle">
                        Russian Title
                    </label>
                    <input
                        type="text"
                        id="russianTitle"
                        value={russianTitle}
                        onChange={(e) => setRussianTitle(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>

                {!isDropdown && (
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-1" htmlFor="url">
                            URL
                        </label>
                        <input
                            type="text"
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full p-2 border rounded"
                            required={!isDropdown}
                        />
                    </div>
                )}

                {isDropdown && (
                    <div className="mb-4 border rounded p-4 bg-gray-50">
                        <h3 className="font-medium mb-2">Dropdown Items</h3>

                        {dropdownItems.length > 0 ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={dropdownItems.map(link => `${link.title}-${link.url}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <ul className="mb-4">
                                        {dropdownItems.map((link, index) => (
                                            <SortableItem
                                                key={`${link.title}-${link.url}`}
                                                id={`${link.title}-${link.url}`}
                                            >
                                                <li className="flex justify-between items-center p-2 bg-white border rounded">
                                                    <div>
                                                        <div className="font-medium">{link.title}</div>
                                                        <div className="text-sm text-blue-600">{link.url}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditDropdownItem(index)}
                                                            className="text-blue-500 hover:text-blue-700"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDropdownItem(index)}
                                                            className="text-red-500 hover:text-red-700"
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
                            <p className="text-gray-500 italic mb-4">No dropdown items</p>
                        )}

                        <div className="border-t pt-3">
                            <h4 className="font-medium mb-2">
                                {editingItemIndex !== null ? 'Edit Item' : 'Add Item to Dropdown'}
                            </h4>
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
                                    placeholder="Russian Title"
                                    value={tempLinkRussianTitle}
                                    onChange={(e) => setTempLinkRussianTitle(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <input
                                    type="text"
                                    placeholder="Link URL"
                                    value={tempLinkUrl}
                                    onChange={(e) => setTempLinkUrl(e.target.value)}
                                    className="border rounded px-3 py-2"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAddDropdownItem}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                                    >
                                        {editingItemIndex !== null ? 'Update Item' : 'Add Item'}
                                    </button>
                                    {editingItemIndex !== null && (
                                        <button
                                            type="button"
                                            onClick={cancelEditingItem}
                                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-4 mt-6">
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                        Save Changes
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/admin/webbuilder/header")}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditHeaderItem;