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
import { GripVertical, Save, X, ArrowLeft } from "lucide-react";

interface BaseSectionItem {
    title: string;
    russian_title: string;
    visible: boolean;
}
interface LinkItem extends BaseSectionItem {
    url: string | null;
    type: "link";
}
interface Section {
    title: string;
    russian_title: string;
    items: LinkItem[];
}

const SortableItem = ({
    id,
    children,
}: {
    id: string;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id });

    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="mb-1.5">
            <Card className="border bg-background">
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

const EditFooterSection: React.FC = () => {
    const { title } = useParams<{ title: string }>();
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    const [section, setSection] = useState<Section | null>(null);
    const [loading, setLoading] = useState(true);

    const [newTitle, setNewTitle] = useState("");
    const [russianTitle, setRussianTitle] = useState("");

    const [items, setItems] = useState<LinkItem[]>([]);
    const [tempTitle, setTempTitle] = useState("");
    const [tempRuTitle, setTempRuTitle] = useState("");
    const [tempUrl, setTempUrl] = useState("");
    const [editingIndex, setEditingItemIndex] = useState<number | null>(null);

    useEffect(() => {
        void fetchSection();
    }, [title]);

    const fetchSection = async () => {
        if (!title) return;

        try {
            setLoading(true);
            const response = await api.get(`/v1/footer/${encodeURIComponent(title)}`);
            setSection(response.data);
            setNewTitle(response.data.title);
            setRussianTitle(response.data.russian_title);
            setItems(response.data.items || []);
        } catch (err) {
            console.error("Failed to fetch footer section:", err);
            toast.error("Failed to load section");
            navigate("/admin/webbuilder/footer");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!section) return;

        try {
            const res = await api.put(`/v1/footer/items/edit/${encodeURIComponent(section.title)}`, {
                title: newTitle.trim(),
                russian_title: russianTitle.trim(),
                items,
            });
            if (res.data?.success) {
                toast.success("Section updated");
                navigate("/admin/webbuilder/footer");
            } else {
                toast.error(res.data?.msg || "Failed to update section");
            }
        } catch (err) {
            console.error("Failed to update section:", err);
            toast.error("Failed to update section");
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setItems((prev) => {
                const oldIndex = prev.findIndex((i) => `${i.title}-${i.url}` === String(active.id));
                const newIndex = prev.findIndex((i) => `${i.title}-${i.url}` === String(over?.id));
                return oldIndex !== -1 && newIndex !== -1 ? arrayMove(prev, oldIndex, newIndex) : prev;
            });
        }
    };

    const addOrUpdateItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempTitle || !tempRuTitle) {
            toast.error("Title and Russian title are required");
            return;
        }
        const next: LinkItem = {
            title: tempTitle,
            russian_title: tempRuTitle,
            url: (tempUrl || "").trim(),
            visible: true,
            type: "link",
        };
        if (editingIndex !== null) {
            const copy = [...items];
            copy[editingIndex] = next;
            setItems(copy);
            setEditingItemIndex(null);
        } else {
            setItems((prev) => [...prev, next]);
        }
        setTempTitle(""); setTempRuTitle(""); setTempUrl("");
    };

    const editItem = (i: number) => {
        const it = items[i];
        setTempTitle(it.title);
        setTempRuTitle(it.russian_title);
        setTempUrl(it.url || "");
        setEditingItemIndex(i);
    };

    const removeItem = (i: number) => {
        setItems((prev) => prev.filter((_, idx) => idx !== i));
        if (editingIndex === i) {
            setTempTitle(""); setTempRuTitle(""); setTempUrl(""); setEditingItemIndex(null);
        }
    };

    const cancelEditingItem = () => {
        setTempTitle(""); setTempRuTitle(""); setTempUrl(""); setEditingItemIndex(null);
    };

    if (loading) return <div className="p-6 text-center">Loading section...</div>;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5">
            <Button variant="ghost" className="px-0" onClick={() => navigate("/admin/webbuilder/footer")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Footer
            </Button>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Edit Section</CardTitle>
                    <CardDescription className="text-xs">Update titles and manage section links.</CardDescription>
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

                        <Separator className="my-2" />

                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Section Items</h3>
                            <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
                        </div>

                        {items.length > 0 ? (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext
                                    items={items.map((i) => `${i.title}-${i.url}`)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-1.5">
                                        {items.map((link, index) => (
                                            <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium">{link.title}</div>
                                                        <div className="truncate text-[11px] text-muted-foreground">{link.url}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => editItem(index)}>
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            </SortableItem>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <div className="rounded-md border p-3 text-xs text-muted-foreground">No items</div>
                        )}

                        <div className="rounded-md border p-4">
                            <h4 className="mb-2 text-sm font-medium">
                                {editingIndex !== null ? "Edit Item" : "Add Item"}
                            </h4>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label>Title</Label>
                                    <Input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Russian Title</Label>
                                    <Input value={tempRuTitle} onChange={(e) => setTempRuTitle(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>URL (optional)</Label>
                                    <Input value={tempUrl} onChange={(e) => setTempUrl(e.target.value)} />
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Button type="button" onClick={addOrUpdateItem}>
                                    {editingIndex !== null ? "Update Item" : "Add Item"}
                                </Button>
                                {editingIndex !== null && (
                                    <Button type="button" variant="secondary" onClick={cancelEditingItem}>
                                        <X className="mr-1 h-4 w-4" /> Cancel
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>

                    <Separator className="my-3" />

                    <CardFooter className="flex items-center gap-2 py-3">
                        <Button type="submit">
                            <Save className="mr-2 h-4 w-4" /> Save Changes
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => navigate("/admin/webbuilder/footer")}>
                            Cancel
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default EditFooterSection;
