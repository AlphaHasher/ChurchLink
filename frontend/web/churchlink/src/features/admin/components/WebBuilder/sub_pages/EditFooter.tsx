import { useState, useEffect } from "react";
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
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
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
import MultiStateBadge from "@/shared/components/MultiStageBadge";

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

interface LinkItem extends FooterItem {
    type?: "link";
}

interface Footer {
    items: FooterSection[];
}

// Visibility toggle component using MultiStateBadge
const FooterVisibilityToggle: React.FC<{ section: FooterSection; onToggle: (title: string, currentVisibility: boolean) => void }> = ({ section, onToggle }) => {
    const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

    const handleToggleVisibility = async () => {
        if (badgeState !== "custom") return;
        const currentVisibility = section.visible ?? false;
        const newVisibility = !currentVisibility;
        setBadgeState("processing");

        try {
            await api.put(`/v1/footer/${section.title}/visibility`, { visible: newVisibility });
            setBadgeState("success");
            setTimeout(() => {
                onToggle(section.title, currentVisibility);
                setBadgeState("custom");
            }, 900);
        } catch (error) {
            console.error("Error updating footer visibility:", error);
            setBadgeState("error");
            setTimeout(() => setBadgeState("custom"), 1200);
        }
    };

    return (
        <div className="flex items-center justify-center h-full w-full overflow-visible">
            <MultiStateBadge
                state={badgeState}
                onClick={handleToggleVisibility}
                customComponent={
                    <span
                        className={`inline-block px-2 py-1 text-xs rounded-full font-medium cursor-pointer ${
                            section.visible
                                ? "bg-green-500/20 text-green-400 dark:bg-green-400 dark:text-green-900"
                                : "bg-red-500/20 text-red-400 dark:bg-red-400 dark:text-red-900"
                        }`}
                    >
                        {section.visible ? "Visible" : "Hidden"}
                    </span>
                }
            />
        </div>
    );
};

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="border-b last:border-0">
            <div className="flex items-center">
                <div {...attributes} {...listeners} className="cursor-grab p-2 mr-2 text-muted-foreground">
                    &#x2630;
                </div>
                <div className="flex-grow">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface EditFooterProps {
    onFooterDataChange?: (data: FooterSection[]) => void;
}

const EditFooter = ({ onFooterDataChange }: EditFooterProps = {}) => {
    const [footer, setFooter] = useState<Footer | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Add section form state
    const [newSectionTitle, setNewSectionTitle] = useState("");
    const [newSectionRussianTitle, setNewSectionRussianTitle] = useState("");
    const [sectionItems, setSectionItems] = useState<FooterItem[]>([]);
    const [tempItemTitle, setTempItemTitle] = useState("");
    const [tempItemRussianTitle, setTempItemRussianTitle] = useState("");
    const [tempItemUrl, setTempItemUrl] = useState("");

    // Edit section form state
    const [editingSection, setEditingSection] = useState<FooterSection | null>(null);
    const [editSectionTitle, setEditSectionTitle] = useState("");
    const [editSectionRussianTitle, setEditSectionRussianTitle] = useState("");
    const [editSectionItems, setEditSectionItems] = useState<LinkItem[]>([]);
    const [editTempItemTitle, setEditTempItemTitle] = useState("");
    const [editTempItemRussianTitle, setEditTempItemRussianTitle] = useState("");
    const [editTempItemUrl, setEditTempItemUrl] = useState("");
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        fetchFooter();
    }, []);

    // Call onFooterDataChange whenever footer data changes
    useEffect(() => {
        if (footer?.items && onFooterDataChange) {
            onFooterDataChange(footer.items);
        }
    }, [footer?.items, onFooterDataChange]);

    const fetchFooter = async () => {
        try {
            setLoading(true);
            const response = await api.get("/v1/footer/items");
            setFooter(response.data);
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

    const handleSaveChanges = async () => {
        if (!footer) return;

        try {
            // Save reordering
            const currentTitles = footer.items.map(item => item.title);
            await api.put("/v1/footer/reorder", { titles: currentTitles });
            toast.success("Footer changes saved successfully");

            // Refresh data from server
            await fetchFooter();
        } catch (err) {
            console.error("Failed to save footer changes:", err);
            toast.error("Failed to save changes");
            await fetchFooter(); // Revert to server state on failure
        }
    };

    // Modal handlers
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
            const res = await api.post("/v1/footer/items", {
                "title": newSectionTitle,
                "russian_title": newSectionRussianTitle,
                "items": sectionItems,
                "visible": false,
            });
            if (res) {
                toast.success("Section added successfully!");
                // Reset form
                setNewSectionTitle("");
                setNewSectionRussianTitle("");
                setSectionItems([]);
                setIsAddModalOpen(false);
                // Refresh footer data
                await fetchFooter();
            }
        } catch (err) {
            console.error("Failed to add section:", err);
            toast.error("Failed to add section");
        }
    };

    const handleAddSectionItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempItemTitle || !tempItemRussianTitle) {
            toast.error("Item title and Russian title are required");
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

    const handleEditSection = (section: FooterSection) => {
        setEditingSection(section);
        setEditSectionTitle(section.title);
        setEditSectionRussianTitle(section.russian_title);
        setEditSectionItems(section.items);
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingSection) return;

        try {
            const updatedSection = {
                title: editSectionTitle,
                russian_title: editSectionRussianTitle,
                items: editSectionItems,
            };

            const response = await api.put(`/v1/footer/items/edit/${editingSection.title}`, updatedSection);

            if (response.data) {
                toast.success("Section updated successfully");
                setIsEditModalOpen(false);
                setEditingSection(null);
                await fetchFooter();
            }
        } catch (err) {
            console.error("Failed to update section:", err);
            toast.error("Failed to update section");
        }
    };

    const handleEditAddItem = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editTempItemTitle || !editTempItemRussianTitle) {
            toast.error("Item title and Russian title are required");
            return;
        }

        if (editingItemIndex !== null) {
            // Update existing item
            const updatedItems = [...editSectionItems];
            updatedItems[editingItemIndex] = {
                title: editTempItemTitle,
                russian_title: editTempItemRussianTitle,
                url: editTempItemUrl || null,
                visible: true,
                type: "link"
            };
            setEditSectionItems(updatedItems);
            setEditingItemIndex(null);
        } else {
            // Add new item
            setEditSectionItems([...editSectionItems, {
                title: editTempItemTitle,
                russian_title: editTempItemRussianTitle,
                url: editTempItemUrl || null,
                visible: true,
                type: "link"
            }]);
        }

        // Reset form fields
        setEditTempItemTitle("");
        setEditTempItemRussianTitle("");
        setEditTempItemUrl("");
    };

    const handleEditItem = (index: number) => {
        const item = editSectionItems[index];
        setEditTempItemTitle(item.title);
        setEditTempItemRussianTitle(item.russian_title);
        setEditTempItemUrl(item.url || "");
        setEditingItemIndex(index);
    };

    const handleRemoveEditItem = (index: number) => {
        setEditSectionItems(editSectionItems.filter((_, i) => i !== index));
        // If we were editing this item, reset the form
        if (editingItemIndex === index) {
            setEditTempItemTitle("");
            setEditTempItemRussianTitle("");
            setEditTempItemUrl("");
            setEditingItemIndex(null);
        }
    };

    const cancelEditingItem = () => {
        setEditTempItemTitle("");
        setEditTempItemRussianTitle("");
        setEditTempItemUrl("");
        setEditingItemIndex(null);
    };

    const handleRemoveSection = (title: string) => {
        setItemToDelete(title);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteSection = async () => {
        if (!itemToDelete) return;

        try {
            await api.delete(`/v1/footer/${itemToDelete}`);
            toast.success(`"${itemToDelete}" removed successfully`);

            if (footer) {
                // Update UI after successful deletion
                const newItems = footer.items.filter(item => item.title !== itemToDelete);
                setFooter({ ...footer, items: newItems });
            }

            // Refresh data from server to ensure consistency
            await fetchFooter();
        } catch (err) {
            console.error("Failed to remove section:", err);
            toast.error(`Failed to remove "${itemToDelete}"`);
            // Refresh to revert any optimistic UI updates
            await fetchFooter();
        } finally {
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
        // Update local state after successful API call from FooterVisibilityToggle
        if (footer) {
            const newItems = footer.items.map(item =>
                item.title === title ? { ...item, visible: !currentVisibility } : item
            );
            setFooter({ ...footer, items: newItems });
        }
    };

    if (loading) return <div className="p-6 text-center">Loading footer data...</div>;

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Edit Footer Sections</CardTitle>
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default">
                                Add Section
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Add Footer Section</DialogTitle>
                                <DialogDescription>
                                    Create a new footer section with items.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddSection} className="flex flex-col gap-4">
                                <Input
                                    type="text"
                                    placeholder="Section Title"
                                    value={newSectionTitle}
                                    onChange={(e) => setNewSectionTitle(e.target.value)}
                                    required
                                />
                                <Input
                                    type="text"
                                    placeholder="Russian Title"
                                    value={newSectionRussianTitle}
                                    onChange={(e) => setNewSectionRussianTitle(e.target.value)}
                                    required
                                />
                                <div className="border rounded p-4 bg-muted">
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
                                                            <li className="flex justify-between items-center p-2 bg-card border rounded">
                                                                <div>
                                                                    <div className="font-medium">{item.title}</div>
                                                                    <div className="text-sm text-blue-600">{item.url}</div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveSectionItem(index)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </li>
                                                        </SortableItem>
                                                    ))}
                                                </ul>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <p className="text-muted-foreground italic mb-4">No links</p>
                                    )}

                                    <div className="border-t pt-3">
                                        <h5 className="font-medium mb-2">Add Item to Section</h5>
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                type="text"
                                                placeholder="Title"
                                                value={tempItemTitle}
                                                onChange={(e) => setTempItemTitle(e.target.value)}
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Russian Title"
                                                value={tempItemRussianTitle}
                                                onChange={(e) => setTempItemRussianTitle(e.target.value)}
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Item URL"
                                                value={tempItemUrl}
                                                onChange={(e) => setTempItemUrl(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleAddSectionItem}
                                                size="sm"
                                                className="self-start"
                                            >
                                                Add to Section
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={sectionItems.length === 0}>
                                        Add Section
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Section Dialog */}
                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Edit Footer Section</DialogTitle>
                                <DialogDescription>
                                    Update the section details and items.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                                <Input
                                    type="text"
                                    placeholder="Section Title"
                                    value={editSectionTitle}
                                    onChange={(e) => setEditSectionTitle(e.target.value)}
                                    required
                                />
                                <Input
                                    type="text"
                                    placeholder="Russian Title"
                                    value={editSectionRussianTitle}
                                    onChange={(e) => setEditSectionRussianTitle(e.target.value)}
                                    required
                                />

                                <div className="border rounded p-4 bg-muted">
                                    <h4 className="font-medium mb-2">Section Items</h4>

                                    {editSectionItems.length > 0 ? (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <SortableContext
                                                items={editSectionItems.map((link) => `${link.title}-${link.url}`)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <ul className="mb-4">
                                                    {editSectionItems.map((link, index) => (
                                                        <SortableItem
                                                            key={`${link.title}-${link.url}`}
                                                            id={`${link.title}-${link.url}`}
                                                        >
                                                            <li className="flex justify-between items-center p-2 bg-card border rounded">
                                                                <div>
                                                                    <div className="font-medium">{link.title}</div>
                                                                    <div className="text-sm text-blue-600">{link.url}</div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleEditItem(index)}
                                                                        className="text-blue-500 hover:text-blue-700"
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleRemoveEditItem(index)}
                                                                        className="text-red-500 hover:text-red-700"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </div>
                                                            </li>
                                                        </SortableItem>
                                                    ))}
                                                </ul>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <p className="text-muted-foreground italic mb-4">No items</p>
                                    )}

                                    <div className="border-t pt-3">
                                        <h5 className="font-medium mb-2">
                                            {editingItemIndex !== null ? 'Edit Item' : 'Add Item to Section'}
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                type="text"
                                                placeholder="Title"
                                                value={editTempItemTitle}
                                                onChange={(e) => setEditTempItemTitle(e.target.value)}
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Russian Title"
                                                value={editTempItemRussianTitle}
                                                onChange={(e) => setEditTempItemRussianTitle(e.target.value)}
                                            />
                                            <Input
                                                type="text"
                                                placeholder="Optional URL"
                                                value={editTempItemUrl}
                                                onChange={(e) => setEditTempItemUrl(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    onClick={handleEditAddItem}
                                                    size="sm"
                                                    className="self-start"
                                                >
                                                    {editingItemIndex !== null ? 'Update Item' : 'Add Item'}
                                                </Button>
                                                {editingItemIndex !== null && (
                                                    <Button
                                                        type="button"
                                                        onClick={cancelEditingItem}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="submit">
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Confirmation Dialog */}
                    <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently remove the footer section "{itemToDelete}" and all its items.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteSection} className="bg-red-600 hover:bg-red-700">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>

            <CardContent>

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
                                                    {('url' in item) && <span className="ml-2 text-sm text-muted-foreground">{(item as FooterItem).url}</span>}
                                                    {('items' in item) && <span className="ml-2 text-sm text-muted-foreground">{item.items.length} item{item.items.length == 1 ? "" : "s"}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <FooterVisibilityToggle section={item} onToggle={handleChangeVisibility} />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditSection(item)}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveSection(item.title)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </li>
                                    </SortableItem>
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <p className="text-muted-foreground">No sections yet. Click "Add Section" to create one.</p>
                )}
            </div>

            {footer && footer.items.length > 0 && (
                <div className="flex gap-4 justify-start mt-6">
                    <Button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                    >
                        Save Changes
                    </Button>
                </div>
            )}
        </CardContent>
    </Card>
    );
};

export default EditFooter;