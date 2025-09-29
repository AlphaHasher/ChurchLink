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

interface HeaderLink {
    title: string;
    russian_title: string;
    url: string;
    visible?: boolean;
    type: "link";
}

interface HeaderDropdown {
    title: string;
    russian_title: string;
    items: HeaderLink[];
    visible?: boolean;
    type: "dropdown";
}

type HeaderItem = HeaderLink | HeaderDropdown;

interface Header {
    items: HeaderItem[];
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

interface EditHeaderProps {
    onHeaderDataChange?: (data: HeaderItem[]) => void;
}

const EditHeader = ({ onHeaderDataChange }: EditHeaderProps = {}) => {
    const [originalHeader, setOriginalHeader] = useState<Header | null>(null);
    const [header, setHeader] = useState<Header | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
        removals: [],
        visibility: {},
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [toRemove, setToRemove] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        void fetchHeader();
    }, []);

    // Call onHeaderDataChange whenever header data changes
    useEffect(() => {
        if (header?.items && onHeaderDataChange) {
            onHeaderDataChange(header.items);
        }
    }, [header?.items, onHeaderDataChange]);

    const fetchHeader = async () => {
        try {
            setLoading(true);
            const response = await api.get("/v1/header/items");
            setOriginalHeader(response.data);
            setHeader(response.data);
            setPendingChanges({ removals: [], visibility: {} });
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error("Failed to fetch header:", err);
            toast.error("Failed to load header data");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!header) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = header.items.findIndex((i) => i.title === active.id);
        const newIndex = header.items.findIndex((i) => i.title === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const newItems = arrayMove(header.items, oldIndex, newIndex);
        setHeader({ ...header, items: newItems });
        setHasUnsavedChanges(true);
    };

    const getEffectiveVisibility = (item: HeaderItem) =>
        item.title in pendingChanges.visibility
            ? pendingChanges.visibility[item.title]
            : item.visible;

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
        setPendingChanges((prev) => ({
            ...prev,
            visibility: {
                ...prev.visibility,
                [title]: !currentVisibility,
            },
        }));

        if (header) {
            const newItems = header.items.map((item) =>
                item.title === title ? { ...item, visible: !currentVisibility } : item
            );
            setHeader({ ...header, items: newItems });
        }

        setHasUnsavedChanges(true);
    };

    const handleRemoveItem = (title: string) => setToRemove(title);

    const actuallyRemove = (title: string) => {
        if (!header) return;
        setPendingChanges((prev) => ({
            ...prev,
            removals: [...prev.removals, title],
        }));
        const newItems = header.items.filter((i) => i.title !== title);
        setHeader({ ...header, items: newItems });
        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!header) return;

        try {
            for (const title of pendingChanges.removals) {
                const del = await api.delete(`/v1/header/${encodeURIComponent(title)}`);
                if (!del.data?.success) {
                    throw new Error(del.data?.msg || `Failed to remove "${title}"`);
                }
            }

            for (const [title, visible] of Object.entries(pendingChanges.visibility)) {
                const vis = await api.put(
                    `/v1/header/${encodeURIComponent(title)}/visibility`,
                    { visible }
                );
                if (!vis.data?.success) {
                    throw new Error(
                        vis.data?.msg || `Failed to update visibility for "${title}"`
                    );
                }
            }

            const currentTitles = header.items.map((i) => i.title);
            const order = await api.put("/v1/header/reorder", { titles: currentTitles });
            if (!order.data?.success) {
                throw new Error(order.data?.msg || "Failed to reorder header items");
            }

            toast.success("Navigation changes saved successfully");
            await fetchHeader();
        } catch (err: any) {
            console.error("Failed to save navigation changes:", err);
            toast.error(err?.message || "Failed to save changes");
            await fetchHeader();
        }
    };

    if (loading) return <div className="p-6 text-center">Loading header data...</div>;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Edit Header Navigation</h2>
                    <p className="text-sm text-muted-foreground">
                        Drag to reorder, toggle visibility, edit or remove items. Changes are staged until you click{" "}
                        <span className="font-medium">Save</span>.
                    </p>
                </div>
                <Button onClick={() => navigate("/admin/webbuilder/header/add")}>
                    <Plus className="mr-2 h-4 w-4" /> Add Navigation Item
                </Button>
            </div>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Current Navigation Items</CardTitle>
                    <CardDescription className="text-xs">
                        The list below reflects your pending edits.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-1.5">
                    {header && header.items.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={header.items.map((i) => i.title)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {header.items.map((item) => {
                                        const visible = !!getEffectiveVisibility(item);
                                        const isDropdown = "items" in item;
                                        return (
                                            <SortableItem key={item.title} id={item.title}>
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium">{item.title}</div>
                                                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            {isDropdown ? (
                                                                <>
                                                                    <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                                                        {item.items.length} link{item.items.length === 1 ? "" : "s"}
                                                                    </Badge>
                                                                    <span>dropdown</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="truncate">{(item as HeaderLink).url}</span>
                                                                    <Badge variant="secondary" className="px-1 py-0 text-[10px]">link</Badge>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-0.5">
                                                        <div className="mr-0.5 flex items-center gap-1">
                                                            <Switch
                                                                checked={visible}
                                                                onCheckedChange={() => handleChangeVisibility(item.title, visible)}
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
                                                                navigate(`/admin/webbuilder/header/edit/${encodeURIComponent(item.title)}`)
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
                                                            onClick={() => handleRemoveItem(item.title)}
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
                            No navigation items yet. Click <span className="font-medium">Add Navigation Item</span> to create one.
                        </div>
                    )}
                </CardContent>

                <Separator />

                <CardFooter className="flex items-center gap-2 py-3">
                    <Button onClick={handleSaveChanges} disabled={!hasUnsavedChanges}>
                        Save Changes
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={!hasUnsavedChanges}>
                        Cancel
                    </Button>
                </CardFooter>
            </Card>

            <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove “{toRemove ?? ""}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the item from your header. You can still revert before saving by cancelling your pending changes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setToRemove(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => {
                                if (toRemove) actuallyRemove(toRemove);
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
                                setHeader(originalHeader);
                                setPendingChanges({ removals: [], visibility: {} });
                                setHasUnsavedChanges(false);
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

export default EditHeader;
