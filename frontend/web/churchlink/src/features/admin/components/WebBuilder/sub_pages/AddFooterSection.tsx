import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/api";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
import { GripVertical, Plus, ArrowLeft } from "lucide-react";

interface FooterItem {
    title: string;
    russian_title: string;
    url: string | null;
    visible?: boolean;
}

const SortableItem = ({
    id,
    children,
}: {
    id: string;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
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

const AddFooterSection = () => {
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    const [title, setTitle] = useState("");
    const [ruTitle, setRuTitle] = useState("");
    const [items, setItems] = useState<FooterItem[]>([]);

    const [tempTitle, setTempTitle] = useState("");
    const [tempRuTitle, setTempRuTitle] = useState("");
    const [tempUrl, setTempUrl] = useState("");

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

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempTitle || !tempRuTitle) {
            toast.error("Item title and Russian title are required");
            return;
        }
        setItems((prev) => [
            ...prev,
            { title: tempTitle, russian_title: tempRuTitle, url: (tempUrl || "").trim() },
        ]);
        setTempTitle(""); setTempRuTitle(""); setTempUrl("");
    };

    const removeItem = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const createSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !ruTitle) {
            toast.error("Section title and Russian title are required");
            return;
        }
        try {
            const res = await api.post("/v1/footer/items", {
                title: title.trim(),
                russian_title: ruTitle.trim(),
                items,
                visible: false,
            });
            if (res.data?.success) {
                toast.success("Section added");
                navigate("/admin/webbuilder/footer");
            } else {
                toast.error(res.data?.msg || "Failed to add section");
            }
        } catch (err) {
            console.error("Failed to add section:", err);
            toast.error("Failed to add section");
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <Button variant="ghost" className="px-0" onClick={() => navigate("/admin/webbuilder/footer")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Footer
            </Button>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Add Section</CardTitle>
                    <CardDescription className="text-xs">Create a footer section and its links.</CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={createSection} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Section Title</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ru">Russian Title</Label>
                            <Input id="ru" value={ruTitle} onChange={(e) => setRuTitle(e.target.value)} required />
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Section Items</h4>
                                <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
                            </div>

                            {items.length > 0 ? (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={items.map((i) => `${i.title}-${i.url}`)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-1.5">
                                            {items.map((link, index) => (
                                                <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                    <div className="flex w-full items-center justify-between">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium">{link.title}</div>
                                                            <div className="truncate text-[11px] text-muted-foreground">{link.url}</div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-destructive"
                                                            onClick={() => removeItem(index)}
                                                            aria-label="Remove"
                                                        >
                                                            <TrashIcon />
                                                        </Button>
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
                                <Button type="button" className="mt-3" onClick={addItem}>
                                    <Plus className="mr-2 h-4 w-4" /> Add to Section
                                </Button>
                            </div>
                        </div>

                        <CardFooter className="px-0">
                            <Button type="submit" disabled={items.length === 0} className="mt-1.5">
                                Create Section
                            </Button>
                        </CardFooter>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

const TrashIcon = () => <span className="inline-flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;

export default AddFooterSection;
