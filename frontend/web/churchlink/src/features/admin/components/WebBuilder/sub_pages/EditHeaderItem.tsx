import React, { useState, useEffect } from "react";
import api from "@/api/api";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

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

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { GripVertical, ArrowLeft, Pencil, Trash2 } from "lucide-react";

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

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} className="mb-1.5">
            <Card>
                <CardContent className="p-2 flex items-center gap-2">
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className="cursor-grab rounded p-1 hover:bg-muted"
                        aria-label="Drag to reorder"
                    >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <div className="flex-1">{children}</div>
                </CardContent>
            </Card>
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

    const [dropdownItems, setDropdownItems] = useState<LinkItem[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkRussianTitle, setTempLinkRussianTitle] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    useEffect(() => {
        void fetchHeaderItem();
    }, [title]);

    const fetchHeaderItem = async () => {
        if (!title) return;

        try {
            setLoading(true);
            const response = await api.get(`/v1/header/${encodeURIComponent(title)}`);
            setItem(response.data);
            setNewTitle(response.data.title);
            setRussianTitle(response.data.russian_title);

            if (response.data.items) {
                setIsDropdown(true);
                setDropdownItems(response.data.items || []);
            } else if (response.data.url) {
                setUrl(response.data.url);
                setIsDropdown(false);
            }
        } catch (err) {
            console.error("Failed to fetch navigation item:", err);
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
                    title: newTitle.trim(),
                    russian_title: russianTitle.trim(),
                    items: dropdownItems,
                }
                : {
                    title: newTitle.trim(),
                    russian_title: russianTitle.trim(),
                    url: url.trim(),
                };

            const response = await api.put(`/v1/header/items/edit/${item.title}`, updatedItem);
            if (response.data?.success) {
                toast.success("Navigation item updated successfully");
                navigate("/admin/webbuilder/header");
            } else {
                toast.error(response.data?.msg || "Failed to update navigation item");
            }
        } catch (err) {
            console.error("Failed to update navigation item:", err);
            toast.error("Failed to update navigation item");
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setDropdownItems((items) => {
                const oldIndex = items.findIndex((i) => `${i.title}-${i.url}` === active.id);
                const newIndex = items.findIndex((i) => `${i.title}-${i.url}` === over?.id);
                return oldIndex !== -1 && newIndex !== -1 ? arrayMove(items, oldIndex, newIndex) : items;
            });
        }
    };

    const handleAddDropdownItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLinkTitle || !tempLinkRussianTitle || !tempLinkUrl) {
            toast.error("Link title, Russian title and URL are required");
            return;
        }
        if (editingItemIndex !== null) {
            const copy = [...dropdownItems];
            copy[editingItemIndex] = {
                title: tempLinkTitle,
                russian_title: tempLinkRussianTitle,
                url: tempLinkUrl,
                visible: true,
                type: "link",
            };
            setDropdownItems(copy);
            setEditingItemIndex(null);
        } else {
            setDropdownItems((prev) => [
                ...prev,
                {
                    title: tempLinkTitle,
                    russian_title: tempLinkRussianTitle,
                    url: tempLinkUrl,
                    visible: true,
                    type: "link",
                },
            ]);
        }
        setTempLinkTitle("");
        setTempLinkRussianTitle("");
        setTempLinkUrl("");
    };

    const handleEditDropdownItem = (index: number) => {
        const it = dropdownItems[index];
        setTempLinkTitle(it.title);
        setTempLinkRussianTitle(it.russian_title);
        setTempLinkUrl(it.url);
        setEditingItemIndex(index);
    };

    const handleRemoveDropdownItem = (index: number) => {
        setDropdownItems((items) => items.filter((_, i) => i !== index));
        if (editingItemIndex === index) {
            setTempLinkTitle(""); setTempLinkRussianTitle(""); setTempLinkUrl(""); setEditingItemIndex(null);
        }
    };

    if (loading) return <div className="p-6 text-center">Loading item data...</div>;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5">
            <Button variant="ghost" className="px-0" onClick={() => navigate("/admin/webbuilder/header")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Header
            </Button>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Edit Navigation Item</CardTitle>
                    <CardDescription className="text-xs">Update titles and URL, or manage dropdown links.</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="ru">Russian Title</Label>
                            <Input id="ru" value={russianTitle} onChange={(e) => setRussianTitle(e.target.value)} required />
                        </div>

                        {!isDropdown && (
                            <div className="grid gap-2">
                                <Label htmlFor="url">URL</Label>
                                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
                            </div>
                        )}

                        {isDropdown && (
                            <div className="space-y-3">
                                {dropdownItems.length > 0 ? (
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext
                                            items={dropdownItems.map((l) => `${l.title}-${l.url}`)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-1.5">
                                                {dropdownItems.map((link, index) => (
                                                    <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                        <div className="flex w-full items-center justify-between">
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium">{link.title}</div>
                                                                <div className="truncate text-[11px] text-muted-foreground">{link.url}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button type="button" variant="ghost" size="sm" onClick={() => handleEditDropdownItem(index)}>
                                                                    <Pencil />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive"
                                                                    onClick={() => handleRemoveDropdownItem(index)}
                                                                >
                                                                    <Trash2 />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </SortableItem>
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                ) : (
                                    <div className="rounded-md border p-3 text-xs text-muted-foreground">No dropdown items</div>
                                )}

                                <div className="rounded-md border p-4">
                                    <h4 className="mb-2 text-sm font-medium">
                                        {editingItemIndex !== null ? "Edit Item" : "Add Item to Dropdown"}
                                    </h4>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <div className="grid gap-2">
                                            <Label>Link Title</Label>
                                            <Input value={tempLinkTitle} onChange={(e) => setTempLinkTitle(e.target.value)} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Russian Title</Label>
                                            <Input value={tempLinkRussianTitle} onChange={(e) => setTempLinkRussianTitle(e.target.value)} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>URL</Label>
                                            <Input value={tempLinkUrl} onChange={(e) => setTempLinkUrl(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <Button type="button" onClick={handleAddDropdownItem}>
                                            {editingItemIndex !== null ? "Update Item" : "Add Item"}
                                        </Button>
                                        {editingItemIndex !== null && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setTempLinkTitle(""); setTempLinkRussianTitle(""); setTempLinkUrl(""); setEditingItemIndex(null);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <Separator className="my-3" />

                    <CardFooter className="flex items-center gap-2 py-3">
                        <Button type="submit">Save Changes</Button>
                        <Button type="button" variant="secondary" onClick={() => navigate("/admin/webbuilder/header")}>
                            Cancel
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default EditHeaderItem;
