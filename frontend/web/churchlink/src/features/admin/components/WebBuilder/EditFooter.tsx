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

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { GripVertical, Eye, EyeOff, Pencil, Trash2, Plus } from "lucide-react";

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


const SortableItem = ({
    id,
    children,
}: {
    id: string;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id });

    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className={`border bg-background ${isDragging ? "ring-2 ring-primary/40" : ""}`}>
                <CardContent className="flex items-center gap-2 p-2">
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

const EditFooter = () => {
    const [originalFooter, setOriginalFooter] = useState<Footer | null>(null);
    const [footer, setFooter] = useState<Footer | null>(null);
    const [loading, setLoading] = useState(true);

    const [pending, setPending] = useState<PendingChanges>({
        removals: [],
        visibility: {},
    });
    const [dirty, setDirty] = useState(false);

    const [toRemove, setToRemove] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        void fetchFooter();
    }, []);

    const fetchFooter = async () => {
        try {
            setLoading(true);
            const res = await api.get("/v1/footer/items");
            setOriginalFooter(res.data);
            setFooter(res.data);
            setPending({ removals: [], visibility: {} });
            setDirty(false);
        } catch (err) {
            console.error("Failed to fetch footer:", err);
            toast.error("Failed to load footer data");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!footer) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = footer.items.findIndex((s) => s.title === active.id);
        const newIndex = footer.items.findIndex((s) => s.title === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const items = arrayMove(footer.items, oldIndex, newIndex);
        setFooter({ ...footer, items });
        setDirty(true);
    };

    const effectiveVisible = (section: FooterSection) =>
        section.title in pending.visibility ? pending.visibility[section.title] : section.visible;

    const toggleVisibility = (title: string, current: boolean) => {
        setPending((p) => ({
            ...p,
            visibility: { ...p.visibility, [title]: !current },
        }));
        if (footer) {
            const items = footer.items.map((s) => (s.title === title ? { ...s, visible: !current } : s));
            setFooter({ ...footer, items });
        }
        setDirty(true);
    };

    const stageRemoval = (title: string) => {
        if (!footer) return;
        setPending((p) => ({ ...p, removals: [...p.removals, title] }));
        setFooter({ ...footer, items: footer.items.filter((s) => s.title !== title) });
        setDirty(true);
    };

    const saveAll = async () => {
        if (!footer) return;
        try {
            for (const title of pending.removals) {
                const del = await api.delete(`/v1/footer/${encodeURIComponent(title)}`);
                if (!del.data?.success) {
                    throw new Error(del.data?.msg || `Failed to remove "${title}"`);
                }
            }

            for (const [title, visible] of Object.entries(pending.visibility)) {
                const vis = await api.put(
                    `/v1/footer/${encodeURIComponent(title)}/visibility`,
                    { visible }
                );
                if (!vis.data?.success) {
                    throw new Error(vis.data?.msg || `Failed to update visibility for "${title}"`);
                }
            }

            const titles = footer.items.map((s) => s.title);
            const order = await api.put("/v1/footer/reorder", { titles });
            if (!order.data?.success) {
                throw new Error(order.data?.msg || "Failed to reorder footer sections");
            }

            toast.success("Footer changes saved");
            await fetchFooter();
        } catch (err: any) {
            console.error("Failed to save footer changes:", err);
            toast.error(err?.message || "Failed to save changes");
            await fetchFooter();
        }
    };

    if (loading) return <div className="p-6 text-center">Loading footer data...</div>;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Edit Footer Sections</h2>
                    <p className="text-sm text-muted-foreground">
                        Drag to reorder, toggle visibility, edit or remove sections. Changes are staged until you click{" "}
                        <span className="font-medium">Save</span>.
                    </p>
                </div>
                <Button onClick={() => navigate("/admin/webbuilder/footer/add")}>
                    <Plus className="mr-2 h-4 w-4" /> Add Section
                </Button>
            </div>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Current Sections</CardTitle>
                    <CardDescription className="text-xs">The list below reflects your pending edits.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-1.5">
                    {footer && footer.items.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={footer.items.map((s) => s.title)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {footer.items.map((section) => {
                                        const visible = !!effectiveVisible(section);
                                        return (
                                            <SortableItem key={section.title} id={section.title}>
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium">{section.title}</div>
                                                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                                                {section.items.length} item{section.items.length === 1 ? "" : "s"}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-0.5">
                                                        <div className="mr-0.5 flex items-center gap-1">
                                                            <Switch
                                                                checked={visible}
                                                                onCheckedChange={() => toggleVisibility(section.title, visible)}
                                                                aria-label="Toggle visibility"
                                                            />
                                                            {visible ? (
                                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                            ) : (
                                                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() =>
                                                                navigate(`/admin/webbuilder/footer/edit/${encodeURIComponent(section.title)}`)
                                                            }
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive"
                                                            aria-label="Remove"
                                                            onClick={() => setToRemove(section.title)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="rounded-md border p-3 text-xs text-muted-foreground">
                            No sections yet. Click <span className="font-medium">Add Section</span> to create one.
                        </div>
                    )}
                </CardContent>

                <Separator />

                <CardFooter className="flex items-center gap-2 py-3">
                    <Button onClick={saveAll} disabled={!dirty}>
                        Save Changes
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={!dirty}>
                        Cancel
                    </Button>
                </CardFooter>
            </Card>

            <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove “{toRemove ?? ""}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the section from your footer. You can still revert before saving by cancelling your
                            pending changes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setToRemove(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => {
                                if (toRemove) stageRemoval(toRemove);
                                setToRemove(null);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard all pending changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will lose all unsaved edits and revert to the last saved state.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setFooter(originalFooter);
                                setPending({ removals: [], visibility: {} });
                                setDirty(false);
                                setConfirmDiscard(false);
                            }}
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default EditFooter;
