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
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Separator } from "@/shared/components/ui/separator";
import { GripVertical, Plus, ArrowLeft, Trash2 } from "lucide-react";

interface HeaderLink {
    title: string;
    russian_title: string;
    url: string;
    visible?: boolean;
    type?: "link";
}

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

const AddHeaderItem = () => {
    const navigate = useNavigate();
    const [itemType, setItemType] = useState<"link" | "dropdown">("link");
    const sensors = useSensors(useSensor(PointerSensor));

    // Link
    const [newLinkTitle, setNewLinkTitle] = useState("");
    const [newLinkRussianTitle, setNewLinkRussianTitle] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");

    // Dropdown
    const [newDropdownTitle, setNewDropdownTitle] = useState("");
    const [newDropdownRussianTitle, setNewDropdownRussianTitle] = useState("");
    const [dropdownLinks, setDropdownLinks] = useState<HeaderLink[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkRussianTitle, setTempLinkRussianTitle] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = dropdownLinks.findIndex((l) => `${l.title}-${l.url}` === active.id);
            const newIndex = dropdownLinks.findIndex((l) => `${l.title}-${l.url}` === over?.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                setDropdownLinks(arrayMove(dropdownLinks, oldIndex, newIndex));
            }
        }
    };

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLinkTitle || !newLinkRussianTitle || !newLinkUrl) {
            toast.error("Title, Russian title and URL are required");
            return;
        }
        try {
            const res = await api.post("/v1/header/items/links", {
                title: newLinkTitle,
                russian_title: newLinkRussianTitle,
                url: newLinkUrl,
                visible: false,
            });
            if (res.data?.success) {
                toast.success("Link added successfully!");
                navigate("/admin/webbuilder/header");
            } else {
                toast.error(res.data?.msg || "Failed to add link");
            }
        } catch (err) {
            console.error("Failed to add link:", err);
            toast.error("Failed to add link");
        }
    };

    const handleAddDropdown = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDropdownTitle || !newDropdownRussianTitle || dropdownLinks.length === 0) {
            toast.error("Dropdown title, Russian title and at least one link are required");
            return;
        }
        try {
            const res = await api.post("/v1/header/items/dropdowns", {
                title: newDropdownTitle,
                russian_title: newDropdownRussianTitle,
                items: dropdownLinks,
                visible: false,
            });
            if (res.data?.success) {
                toast.success("Dropdown added successfully!");
                navigate("/admin/webbuilder/header");
            } else {
                toast.error(res.data?.msg || "Failed to add dropdown");
            }
        } catch (err) {
            console.error("Failed to add dropdown:", err);
            toast.error("Failed to add dropdown");
        }
    };

    const handleAddDropdownLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLinkTitle || !tempLinkRussianTitle || !tempLinkUrl) {
            toast.error("Link title, Russian title and URL are required");
            return;
        }
        setDropdownLinks((prev) => [
            ...prev,
            { title: tempLinkTitle, russian_title: tempLinkRussianTitle, url: tempLinkUrl, type: "link" },
        ]);
        setTempLinkTitle("");
        setTempLinkRussianTitle("");
        setTempLinkUrl("");
    };

    const handleRemoveDropdownLink = (index: number) => {
        setDropdownLinks(dropdownLinks.filter((_, i) => i !== index));
    };

    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <Button variant="ghost" className="px-0" onClick={() => navigate("/admin/webbuilder/header")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Header
            </Button>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Add Navigation Item</CardTitle>
                    <CardDescription className="text-xs">Create a single link or a dropdown group.</CardDescription>
                </CardHeader>

                <CardContent>
                    <Tabs value={itemType} onValueChange={(v) => setItemType(v as any)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="link">Link</TabsTrigger>
                            <TabsTrigger value="dropdown">Dropdown</TabsTrigger>
                        </TabsList>

                        <TabsContent value="link" className="mt-4">
                            <form onSubmit={handleAddLink} className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Link Title</Label>
                                    <Input value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Russian Title</Label>
                                    <Input value={newLinkRussianTitle} onChange={(e) => setNewLinkRussianTitle(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>URL</Label>
                                    <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} required />
                                </div>
                                <Button type="submit" className="mt-1.5">Add</Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="dropdown" className="mt-4">
                            <form onSubmit={handleAddDropdown} className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dropdown Title</Label>
                                    <Input value={newDropdownTitle} onChange={(e) => setNewDropdownTitle(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Russian Title</Label>
                                    <Input value={newDropdownRussianTitle} onChange={(e) => setNewDropdownRussianTitle(e.target.value)} required />
                                </div>

                                <Separator className="my-2" />

                                <div className="space-y-3">
                                    {dropdownLinks.length > 0 ? (
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext
                                                items={dropdownLinks.map((l) => `${l.title}-${l.url}`)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-1.5">
                                                    {dropdownLinks.map((link, index) => (
                                                        <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                            <div className="flex w-full items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-medium">{link.title}</div>
                                                                    <div className="truncate text-[11px] text-muted-foreground">{link.url}</div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive"
                                                                    aria-label="Remove"
                                                                    onClick={() => handleRemoveDropdownLink(index)}
                                                                >
                                                                    <Trash2 />
                                                                </Button>
                                                            </div>
                                                        </SortableItem>
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <div className="rounded-md border p-3 text-xs text-muted-foreground">No links</div>
                                    )}

                                    <div className="rounded-md border p-4">
                                        <h5 className="mb-2 text-sm font-medium">Add Link to Dropdown</h5>
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
                                        <Button type="button" className="mt-3" onClick={handleAddDropdownLink}>
                                            <Plus className="mr-2 h-4 w-4" /> Add to Dropdown
                                        </Button>
                                    </div>
                                </div>

                                <Button type="submit" className="mt-2" disabled={dropdownLinks.length === 0}>
                                    Add
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

export default AddHeaderItem;
