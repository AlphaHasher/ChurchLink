// AddHeaderItem.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/api";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface HeaderLink {
    title: string;
    russian_title: string;
    url: string;
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

const AddHeaderItem = () => {
    const navigate = useNavigate();
    const [itemType, setItemType] = useState<"link" | "dropdown">("link");
    const sensors = useSensors(useSensor(PointerSensor));

    // For simple links
    const [newLinkTitle, setNewLinkTitle] = useState("");
    const [newLinkRussianTitle, setNewLinkRussianTitle] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");

    // For dropdowns
    const [newDropdownTitle, setNewDropdownTitle] = useState("");
    const [newDropdownRussianTitle, setNewDropdownRussianTitle] = useState("");
    const [dropdownLinks, setDropdownLinks] = useState<HeaderLink[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkRussianTitle, setTempLinkRussianTitle] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = dropdownLinks.findIndex((link) => `${link.title}-${link.url}` === active.id);
            const newIndex = dropdownLinks.findIndex((link) => `${link.title}-${link.url}` === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                setDropdownLinks(arrayMove(dropdownLinks, oldIndex, newIndex));
            }
        }
    };

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLinkTitle || !newLinkUrl) {
            toast.error("Title and URL are required");
            return;
        }
        try {
            const res = await api.post("/v1/header/items/links", {
                "title": newLinkTitle,
                "russian_title": newLinkRussianTitle,
                "url": newLinkUrl,
                "visible": false,
            });
            if (res) {
                navigate("/admin/webbuilder/header");
                toast.success("Link added successfully!");
            }
        } catch (err) {
            console.error("Failed to add link:", err);
            toast.error("Failed to add link");
        }
    };

    const handleAddDropdown = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDropdownTitle) {
            toast.error("Dropdown title is required");
            return;
        }

        if (!newDropdownRussianTitle) {
            toast.error("Dropdown russian title is required");
            return;
        }

        try {
            const res = await api.post("/v1/header/items/dropdowns", {
                "title": newDropdownTitle,
                "russian_title": newDropdownRussianTitle,
                "items": dropdownLinks,
                "visible": false,
            });
            if (res) {
                navigate("/admin/webbuilder/header");
                toast.success("Dropdown added successfully!");
            }
        } catch (err) {
            console.error("Failed to add dropdown:", err);
            toast.error("Failed to add dropdown");
        }
    };

    const handleAddDropdownLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLinkTitle || !tempLinkRussianTitle || !tempLinkUrl) {
            toast.error("Link title and URL are required");
            return;
        }
        setDropdownLinks([...dropdownLinks, { title: tempLinkTitle, russian_title: tempLinkRussianTitle, url: tempLinkUrl }]);
        setTempLinkTitle("");
        setTempLinkRussianTitle("");
        setTempLinkUrl("");
    };

    const handleRemoveDropdownLink = (index: number) => {
        setDropdownLinks(dropdownLinks.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-xl mx-auto bg-white shadow-md p-6 rounded">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add Navigation Item</h2>
                <button
                    onClick={() => navigate("/admin/webbuilder/header")}
                    className="text-white hover:underline"
                >
                    Back to Header
                </button>
            </div>

            <div className="mb-4">
                <div className="flex gap-4">
                    <button
                        type="button"
                        className={`px-4 py-2 rounded ${itemType === "link" ? "text-white" : "text-gray-500"
                            }`}
                        onClick={() => setItemType("link")}
                    >
                        Link
                    </button>
                    <button
                        type="button"
                        className={`px-4 py-2 rounded ${itemType === "dropdown" ? "text-white" : "text-gray-500"
                            }`}
                        onClick={() => setItemType("dropdown")}
                    >
                        Dropdown
                    </button>
                </div>
            </div>

            {itemType === "link" ? (
                <form onSubmit={handleAddLink} className="flex flex-col gap-3">
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
                        placeholder="Russian Title"
                        value={newLinkRussianTitle}
                        onChange={(e) => setNewLinkRussianTitle(e.target.value)}
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
                        Add
                    </button>
                </form>
            ) : (
                <form onSubmit={handleAddDropdown} className="flex flex-col gap-3">
                    <input
                        type="text"
                        placeholder="Dropdown Title"
                        value={newDropdownTitle}
                        onChange={(e) => setNewDropdownTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Russian Title"
                        value={newDropdownRussianTitle}
                        onChange={(e) => setNewDropdownRussianTitle(e.target.value)}
                        className="border rounded px-3 py-2"
                        required
                    />
                    <div className="border rounded p-4 bg-gray-50">
                        <h4 className="font-medium mb-2">Dropdown Links</h4>

                        {dropdownLinks.length > 0 ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={dropdownLinks.map((link) => `${link.title}-${link.url}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <ul className="mb-4">
                                        {dropdownLinks.map((link, index) => (
                                            <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                <li className="flex justify-between items-center p-2 bg-white border rounded">
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
                                            </SortableItem>
                                        ))}
                                    </ul>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <p className="text-gray-500 italic mb-4">No links</p>
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
                                <button
                                    type="button"
                                    onClick={handleAddDropdownLink}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                                >
                                    Add to Dropdown
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        disabled={dropdownLinks.length === 0}
                    >
                        Add
                    </button>
                </form>
            )}
        </div>
    );
};

export default AddHeaderItem;