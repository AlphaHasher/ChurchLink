// EditHeader.tsx - Updated to batch changes
import { useState, useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/provider/LanguageProvider";
import { AddLocaleDialog, ensureHeaderLocale, translateStrings } from "@/shared/utils/localizationUtils";


interface HeaderLink {
    title: string;
    titles?: Record<string, string>;
    url?: string;
    slug?: string;
    is_hardcoded_url?: boolean;
    visible?: boolean;
}

interface HeaderDropdown {
    title: string;
    titles?: Record<string, string>;
    items: HeaderLink[];
    visible?: boolean;
}

interface LinkItem extends HeaderLink {
    type?: "link";
}

type HeaderItem = HeaderLink | HeaderDropdown;

// Visibility toggle component using MultiStateBadge
const VisibilityToggle: React.FC<{ item: HeaderItem; onToggle: (title: string, currentVisibility: boolean) => void }> = ({ item, onToggle }) => {
    const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

    const handleToggleVisibility = async () => {
        if (badgeState !== "custom") return;
        const currentVisibility = item.visible ?? false;
        const newVisibility = !currentVisibility;
        setBadgeState("processing");

        try {
            await api.put(`/v1/header/${item.title}/visibility`, { visible: newVisibility });
            setBadgeState("success");
            setTimeout(() => {
                onToggle(item.title, currentVisibility);
                setBadgeState("custom");
            }, 900);
        } catch (error) {
            console.error("Error updating visibility:", error);
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
                            item.visible
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}
                    >
                        {item.visible ? "Visible" : "Hidden"}
                    </span>
                }
            />
        </div>
    );
};

interface Header {
    items: HeaderItem[];
}

interface Page {
    _id: string;
    title: string;
    slug: string;
    visible: boolean;
}

interface PendingChanges {
    visibility: Record<string, boolean>;
}

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

interface EditHeaderProps {
    onHeaderDataChange?: (data: HeaderItem[]) => void;
}

const EditHeader = ({ onHeaderDataChange }: EditHeaderProps = {}) => {
    const [originalHeader, setOriginalHeader] = useState<Header | null>(null);
    const [header, setHeader] = useState<Header | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
        visibility: {}
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [itemType, setItemType] = useState<"link" | "dropdown">("link");

    // For simple links
    const [newLinkTitle, setNewLinkTitle] = useState("");
    const [newLinkSlug, setNewLinkSlug] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [newLinkIsHardcoded, setNewLinkIsHardcoded] = useState(false);

    // For dropdowns
    const [newDropdownTitle, setNewDropdownTitle] = useState("");
    const [dropdownLinks, setDropdownLinks] = useState<HeaderLink[]>([]);
    const [tempLinkTitle, setTempLinkTitle] = useState("");
    const [tempLinkSlug, setTempLinkSlug] = useState("");
    const [tempLinkUrl, setTempLinkUrl] = useState("");
    const [tempLinkIsHardcoded, setTempLinkIsHardcoded] = useState(false);

    // For editing
    const [editingItem, setEditingItem] = useState<HeaderItem | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editSlug, setEditSlug] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [editIsHardcoded, setEditIsHardcoded] = useState(false);
    const [editDropdownItems, setEditDropdownItems] = useState<LinkItem[]>([]);
    const [editTempLinkTitle, setEditTempLinkTitle] = useState("");
    const [editTempLinkSlug, setEditTempLinkSlug] = useState("");
    const [editTempLinkUrl, setEditTempLinkUrl] = useState("");
    const [editTempLinkIsHardcoded, setEditTempLinkIsHardcoded] = useState(false);
    const [editingDropdownIndex, setEditingDropdownIndex] = useState<number | null>(null);

    // Pages for dropdown
    const [pages, setPages] = useState<Page[]>([]);

    // Locales management for header labels
    const { siteLocales, addSiteLocale, refreshSiteLocales } = useLanguage();
    const [addLocaleOpen, setAddLocaleOpen] = useState(false);
    const [headerLocale, setHeaderLocale] = useState<string>('en');

    const sensors = useSensors(useSensor(PointerSensor));

    // Default static public routes (no wildcard params)
    const defaultPublicRoutes = useMemo(
        () => [
            { slug: "live", title: "Live" },
            { slug: "thank-you", title: "Thank You" },
            { slug: "sermons", title: "Sermons" },
            { slug: "weekly-bulletin", title: "Weekly Bulletin" },
        ],
        []
    );

    // Combine static routes with CMS pages; exclude any routes with wildcard params
    const combinedPageOptions = useMemo(() => {
        const options: { slug: string; title: string }[] = [];
        const seen = new Set<string>();

        // Add defaults first
        for (const r of defaultPublicRoutes) {
            if (!r.slug.includes(":")) {
                options.push({ slug: r.slug, title: r.title });
                seen.add(r.slug);
            }
        }

        // Add default pages
        for (const p of pages) {
            if (p?.slug && !p.slug.includes(":")) {
                if (!seen.has(p.slug)) {
                    options.push({ slug: p.slug, title: p.title });
                    seen.add(p.slug);
                }
            }
        }

        return options;
    }, [pages, defaultPublicRoutes]);

    useEffect(() => {
        fetchHeader();
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            const response = await api.get("/v1/pages/");
            setPages(response.data);
        } catch (error) {
            console.error("Error fetching pages:", error);
        }
    };

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
            // Reset pending changes
            setPendingChanges({ visibility: {} });
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error("Failed to fetch header:", err);
            toast.error("Failed to load header data");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!header) return;

        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = header.items.findIndex(item => item.title === active.id);
            const newIndex = header.items.findIndex(item => item.title === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newItems = arrayMove(header.items, oldIndex, newIndex);
                setHeader({ ...header, items: newItems });
                setHasUnsavedChanges(true);
            }
        }
    };

    const handleRemoveItem = (title: string) => {
        setItemToDelete(title);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteItem = async () => {
        if (!itemToDelete) return;

        try {
            await api.delete(`/v1/header/${itemToDelete}`);
            toast.success(`"${itemToDelete}" removed successfully`);

            if (header) {
                // Update UI after successful deletion
                const newItems = header.items.filter(item => item.title !== itemToDelete);
                setHeader({ ...header, items: newItems });
            }

            // Refresh data from server to ensure consistency
            await fetchHeader();
        } catch (err) {
            console.error("Failed to remove navigation item:", err);
            toast.error(`Failed to remove "${itemToDelete}"`);
            // Refresh to revert any optimistic UI updates
            await fetchHeader();
        } finally {
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
        // Update local state after successful API call from VisibilityToggle
        if (header) {
            const newItems = header.items.map(item =>
                item.title === title ? { ...item, visible: !currentVisibility } : item
            );
            setHeader({ ...header, items: newItems });
        }
    };

    const handleSaveChanges = async () => {
        if (!header) return;

        try {
            // Apply all changes at once

            // 1. Apply visibility changes
            for (const [title, visible] of Object.entries(pendingChanges.visibility)) {
                await api.put(`/v1/header/${title}/visibility`, { visible });
            }

            // 2. Save reordering
            const currentTitles = header.items.map(item => item.title);
            await api.put("/v1/header/reorder", { titles: currentTitles });
            toast.success("Navigation changes saved successfully");

            // Refresh data from server
            await fetchHeader();
        } catch (err) {
            console.error("Failed to save navigation changes:", err);
            toast.error("Failed to save changes");
            await fetchHeader(); // Revert to server state on failure
        }
    };

    const handleCancelChanges = () => {
        if (hasUnsavedChanges && confirm("Are you sure you want to discard all pending changes?")) {
            setHeader(originalHeader);
            setPendingChanges({ visibility: {} });
            setHasUnsavedChanges(false);
        }
    };

    // Modal functions
    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLinkTitle) {
            toast.error("Title is required");
            return;
        }

        if (newLinkIsHardcoded && !newLinkUrl) {
            toast.error("URL is required when hardcoded URL is enabled");
            return;
        }

        if (!newLinkIsHardcoded && !newLinkSlug) {
            toast.error("Page selection is required when not using hardcoded URL");
            return;
        }

        try {
            const linkData: any = {
                "title": newLinkTitle,
                "titles": { en: newLinkTitle },
                "is_hardcoded_url": newLinkIsHardcoded,
                "visible": false,
            };

            if (newLinkIsHardcoded) {
                linkData.url = newLinkUrl;
            } else {
                linkData.slug = newLinkSlug;
            }

            const res = await api.post("/v1/header/items/links", linkData);
            
            // Check if the response indicates success
            if (res?.data?.success) {
                toast.success("Link added successfully!");
                // Reset form
                setNewLinkTitle("");
                setNewLinkSlug("");
                setNewLinkUrl("");
                setNewLinkIsHardcoded(false);
                setIsAddModalOpen(false);
                // Refresh header data
                await fetchHeader();
            } else {
                // Show specific error message from backend
                const errorMsg = res?.data?.msg || "Failed to add link";
                toast.error(errorMsg);
            }
        } catch (err: any) {
            console.error("Failed to add link:", err);
            
            // Try to extract error message from response
            const errorMsg = err?.response?.data?.msg || 
                           err?.response?.data?.message || 
                           err?.message || 
                           "Failed to add link";
            toast.error(errorMsg);
        }
    };

    const handleAddDropdown = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDropdownTitle) {
            toast.error("Dropdown title is required");
            return;
        }

        try {
            const processedLinks = dropdownLinks.map((l) => ({
                title: l.title,
                titles: l.titles && l.titles.en ? l.titles : { en: l.title },
                is_hardcoded_url: !!l.is_hardcoded_url,
                url: l.is_hardcoded_url ? l.url : undefined,
                slug: l.is_hardcoded_url ? undefined : l.slug,
                visible: l.visible !== false,
            }));
            const res = await api.post("/v1/header/items/dropdowns", {
                "title": newDropdownTitle,
                "titles": { en: newDropdownTitle },
                "items": processedLinks,
                "visible": false,
            });
            
            // Check if the response indicates success
            if (res?.data?.success) {
                toast.success("Dropdown added successfully!");
                // Reset form
                setNewDropdownTitle("");
                setDropdownLinks([]);
                setIsAddModalOpen(false);
                // Refresh header data
                await fetchHeader();
            } else {
                // Show specific error message from backend
                const errorMsg = res?.data?.msg || "Failed to add dropdown";
                toast.error(errorMsg);
            }
        } catch (err: any) {
            console.error("Failed to add dropdown:", err);
            
            // Try to extract error message from response
            const errorMsg = err?.response?.data?.msg || 
                           err?.response?.data?.message || 
                           err?.message || 
                           "Failed to add dropdown";
            toast.error(errorMsg);
        }
    };

    const handleAddDropdownLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLinkTitle) {
            toast.error("Link title is required");
            return;
        }

        if (tempLinkIsHardcoded && !tempLinkUrl) {
            toast.error("URL is required when hardcoded URL is enabled");
            return;
        }

        if (!tempLinkIsHardcoded && !tempLinkSlug) {
            toast.error("Page selection is required when not using hardcoded URL");
            return;
        }

        const linkData: HeaderLink = {
            title: tempLinkTitle,
            titles: { en: tempLinkTitle },
            is_hardcoded_url: tempLinkIsHardcoded,
            visible: true,
        };

        if (tempLinkIsHardcoded) {
            linkData.url = tempLinkUrl;
        } else {
            linkData.slug = tempLinkSlug;
        }

        setDropdownLinks([...dropdownLinks, linkData]);
        setTempLinkTitle("");
        setTempLinkSlug("");
        setTempLinkUrl("");
        setTempLinkIsHardcoded(false);
    };

    const handleRemoveDropdownLink = (index: number) => {
        setDropdownLinks(dropdownLinks.filter((_, i) => i !== index));
    };

    // Edit functions
    const handleEditItem = (item: HeaderItem) => {
        setEditingItem(item);
        setEditTitle(item.title);

        if ('url' in item) {
            setEditSlug(item.slug || "");
            setEditUrl(item.url || "");
            setEditIsHardcoded(item.is_hardcoded_url || false);
            setEditDropdownItems([]);
        } else if ('items' in item) {
            setEditSlug("");
            setEditUrl("");
            setEditIsHardcoded(false);
            setEditDropdownItems(item.items);
        }

        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingItem) return;

        if (!editTitle) {
            toast.error("Title is required");
            return;
        }

        try {
            const updatedItem: any = {
                title: editTitle,
                titles: { en: editTitle },
            };

            if ('url' in editingItem) {
                updatedItem.is_hardcoded_url = editIsHardcoded;
                if (editIsHardcoded) {
                    if (!editUrl) {
                        toast.error("URL is required when hardcoded URL is enabled");
                        return;
                    }
                    updatedItem.url = editUrl;
                } else {
                    if (!editSlug) {
                        toast.error("Page selection is required when not using hardcoded URL");
                        return;
                    }
                    updatedItem.slug = editSlug;
                }
            } else if ('items' in editingItem) {
                updatedItem.items = editDropdownItems.map((sub) => ({
                    title: sub.title,
                    titles: (sub as any).titles && (sub as any).titles.en ? (sub as any).titles : { en: sub.title },
                    is_hardcoded_url: !!(sub as any).is_hardcoded_url,
                    url: (sub as any).is_hardcoded_url ? (sub as any).url : undefined,
                    slug: (sub as any).is_hardcoded_url ? undefined : (sub as any).slug,
                    visible: (sub as any).visible !== false,
                    type: "link",
                }));
            }

            const response = await api.put(`/v1/header/items/edit/${editingItem.title}`, updatedItem);

            // Check if the response indicates success
            if (response?.data?.success) {
                toast.success("Navigation item updated successfully");
                setIsEditModalOpen(false);
                setEditingItem(null);
                await fetchHeader();
            } else {
                // Show specific error message from backend
                const errorMsg = response?.data?.msg || "Failed to update navigation item";
                toast.error(errorMsg);
            }
        } catch (err: any) {
            console.error("Failed to update navigation item:", err);
            
            // Try to extract error message from response
            const errorMsg = err?.response?.data?.msg || 
                           err?.response?.data?.message || 
                           err?.message || 
                           "Failed to update navigation item";
            toast.error(errorMsg);
        }
    };

    const handleEditAddDropdownItem = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editTempLinkTitle) {
            toast.error("Link title is required");
            return;
        }

        if (editTempLinkIsHardcoded && !editTempLinkUrl) {
            toast.error("URL is required when hardcoded URL is enabled");
            return;
        }

        if (!editTempLinkIsHardcoded && !editTempLinkSlug) {
            toast.error("Page selection is required when not using hardcoded URL");
            return;
        }

        const linkData: any = {
            title: editTempLinkTitle,
            titles: { en: editTempLinkTitle },
            is_hardcoded_url: editTempLinkIsHardcoded,
            visible: true,
            type: "link"
        };

        if (editTempLinkIsHardcoded) {
            linkData.url = editTempLinkUrl;
        } else {
            linkData.slug = editTempLinkSlug;
        }

        if (editingDropdownIndex !== null) {
            // Update existing item
            const updatedItems = [...editDropdownItems];
            updatedItems[editingDropdownIndex] = linkData;
            setEditDropdownItems(updatedItems);
            setEditingDropdownIndex(null);
        } else {
            // Add new item
            setEditDropdownItems([...editDropdownItems, linkData]);
        }

        // Reset form fields
        setEditTempLinkTitle("");
        setEditTempLinkSlug("");
        setEditTempLinkUrl("");
        setEditTempLinkIsHardcoded(false);
    };

    const handleEditDropdownItem = (index: number) => {
        const item = editDropdownItems[index];
        setEditTempLinkTitle(item.title);
        setEditTempLinkSlug(item.slug || "");
        setEditTempLinkUrl(item.url || "");
        setEditTempLinkIsHardcoded(item.is_hardcoded_url || false);
        setEditingDropdownIndex(index);
    };

    const handleRemoveEditDropdownItem = (index: number) => {
        setEditDropdownItems(editDropdownItems.filter((_, i) => i !== index));
        // If we were editing this item, reset the form
        if (editingDropdownIndex === index) {
            setEditTempLinkTitle("");
            setEditTempLinkUrl("");
            setEditingDropdownIndex(null);
        }
    };

    const cancelEditingDropdownItem = () => {
        setEditTempLinkTitle("");
        setEditTempLinkSlug("");
        setEditTempLinkUrl("");
        setEditTempLinkIsHardcoded(false);
        setEditingDropdownIndex(null);
    };

    if (loading) return <div className="p-6 text-center">Loading header data...</div>;

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Edit Header Navigation</CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={headerLocale} onValueChange={async (val) => { setHeaderLocale(val); await ensureHeaderLocale(header?.items || [], val); }}>
                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Locale" /></SelectTrigger>
                            <SelectContent>
                                {(siteLocales && siteLocales.length ? siteLocales : ['en']).map((lc) => (
                                    <SelectItem key={lc} value={lc}>{lc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <AddLocaleDialog
                            open={addLocaleOpen}
                            onOpenChange={setAddLocaleOpen}
                            siteLocales={siteLocales || ['en']}
                            addSiteLocale={addSiteLocale}
                            refreshSiteLocales={refreshSiteLocales}
                            onAddLocale={async (code: string) => {
                                const items = collectHeaderTitles(header?.items || []);
                                if (!items.length) return;
                                setLoading(true);
                                try {
                                    await translateStrings(items, [code], 'en');
                                    await seedGlobalTranslations(code, 'header');
                                    toast.success(`Locale "${code}" translations seeded for header`);
                                    setHeaderLocale(code);
                                    await ensureHeaderLocale(header?.items || [], code);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                    </div>
                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default">
                                Add Navigation Item
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] border border-border shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Add Navigation Item</DialogTitle>
                                <DialogDescription>
                                    Choose the type of navigation item you want to add.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="flex gap-4">
                                    <Button
                                        type="button"
                                        variant={itemType === "link" ? "default" : "outline"}
                                        className={`flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-border ${
                                        itemType !== "link"
                                            ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                            : ""
                                        }`}
                                        onClick={() => setItemType("link")}
                                    >
                                        Link
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={itemType === "dropdown" ? "default" : "outline"}
                                        className={`flex items-center gap-2 focus-visible:ring-1 focus-visible:ring-border ${
                                        itemType !== "dropdown"
                                            ? "bg-card text-foreground border-border hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                                            : ""
                                        }`}
                                        onClick={() => setItemType("dropdown")}
                                    >
                                        Dropdown
                                    </Button>
                                </div>

                                {itemType === "link" ? (
                                    <form onSubmit={handleAddLink} className="flex flex-col gap-4">
                                        <Input
                                            type="text"
                                            placeholder="Link Title"
                                            className="placeholder:text-muted-foreground/70"
                                            value={newLinkTitle}
                                            onChange={(e) => setNewLinkTitle(e.target.value)}
                                            required
                                        />
                                        <div className="space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="hardcode-url"
                                                    checked={newLinkIsHardcoded}
                                                    onCheckedChange={(checked) => setNewLinkIsHardcoded(checked as boolean)}
                                                />
                                                <label
                                                    htmlFor="hardcode-url"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    Hardcode URL
                                                </label>
                                            </div>

                                            {newLinkIsHardcoded ? (
                                                <Input
                                                    type="text"
                                                    placeholder="Link URL"
                                                    value={newLinkUrl}
                                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                                    required
                                                />
                                            ) : (
                                                <Select value={newLinkSlug} onValueChange={setNewLinkSlug} required>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a page" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {combinedPageOptions.map((opt) => (
                                                            <SelectItem key={`opt-${opt.slug}`} value={opt.slug}>
                                                                {opt.title.charAt(0).toUpperCase() + opt.title.slice(1)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit">
                                                Add Link
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                ) : (
                                    <form onSubmit={handleAddDropdown} className="flex flex-col gap-4">
                                        <Input
                                            type="text"
                                            placeholder="Dropdown Title"
                                            className="placeholder:text-muted-foreground/70"
                                            value={newDropdownTitle}
                                            onChange={(e) => setNewDropdownTitle(e.target.value)}
                                            required
                                        />
                                        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
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
                                                                    <li className="flex justify-between items-center p-2 bg-card border rounded shadow-sm">
                                                                        <div>
                                                                            <div className="font-medium">{link.title}</div>
                                                                            <div className="text-sm text-primary">{link.url}</div>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleRemoveDropdownLink(index)}
                                                                            className="text-destructive hover:text-destructive/80"
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
                                                <h5 className="font-medium mb-2">Add Link to Dropdown</h5>
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        type="text"
                                                        placeholder="Link Title"
                                                        className="placeholder:text-muted-foreground/70"
                                                        value={tempLinkTitle}
                                                        onChange={(e) => setTempLinkTitle(e.target.value)}
                                                    />
                                                    <div className="space-y-2">
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="dropdown-hardcode-url"
                                                                checked={tempLinkIsHardcoded}
                                                                onCheckedChange={(checked) => setTempLinkIsHardcoded(checked as boolean)}
                                                            />
                                                            <label
                                                                htmlFor="dropdown-hardcode-url"
                                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                Hardcode URL
                                                            </label>
                                                        </div>

                                                        {tempLinkIsHardcoded ? (
                                                            <Input
                                                                type="text"
                                                                placeholder="Link URL"
                                                                value={tempLinkUrl}
                                                                onChange={(e) => setTempLinkUrl(e.target.value)}
                                                            />
                                                        ) : (
                                                            <Select value={tempLinkSlug} onValueChange={setTempLinkSlug}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select a page" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {combinedPageOptions.map((opt) => (
                                                                        <SelectItem key={`opt-${opt.slug}`} value={opt.slug}>
                                                                            {opt.title.charAt(0).toUpperCase() + opt.title.slice(1)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={handleAddDropdownLink}
                                                        size="sm"
                                                        className="self-start"
                                                    >
                                                        Add to Dropdown
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button type="submit" disabled={dropdownLinks.length === 0}>
                                                Add Dropdown
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Item Dialog */}
                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Edit Navigation Item</DialogTitle>
                                <DialogDescription>
                                    Update the navigation item details.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                                <Input
                                    type="text"
                                    placeholder="Title"
                                    className="placeholder:text-muted-foreground/70"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    required
                                />

                                {editingItem && 'url' in editingItem && (
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-hardcode-url"
                                                checked={editIsHardcoded}
                                                onCheckedChange={(checked) => setEditIsHardcoded(checked as boolean)}
                                            />
                                            <label
                                                htmlFor="edit-hardcode-url"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Hardcode URL
                                            </label>
                                        </div>

                                        {editIsHardcoded ? (
                                            <Input
                                                type="text"
                                                placeholder="URL"
                                                value={editUrl}
                                                onChange={(e) => setEditUrl(e.target.value)}
                                                required
                                            />
                                        ) : (
                                            <Select value={editSlug} onValueChange={setEditSlug} required>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a page" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {combinedPageOptions.map((opt) => (
                                                        <SelectItem key={`opt-${opt.slug}`} value={opt.slug}>
                                                            {opt.title.charAt(0).toUpperCase() + opt.title.slice(1)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}

                                {editingItem && 'items' in editingItem && (
                                    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                                        <h4 className="font-medium mb-2">Dropdown Items</h4>

                                        {editDropdownItems.length > 0 ? (
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <SortableContext
                                                    items={editDropdownItems.map((link) => `${link.title}-${link.url}`)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    <ul className="mb-4">
                                                        {editDropdownItems.map((link, index) => (
                                                            <SortableItem key={`${link.title}-${link.url}`} id={`${link.title}-${link.url}`}>
                                                                <li className="flex justify-between items-center p-2 bg-card border rounded">
                                                                    <div>
                                                                        <div className="font-medium">{link.title}</div>
                                                                        <div className="text-sm text-primary">{link.url}</div>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleEditDropdownItem(index)}
                                                                            className="text-primary hover:text-primary/80"
                                                                        >
                                                                            Edit
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleRemoveEditDropdownItem(index)}
                                                                            className="text-destructive hover:text-destructive/80"
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
                                            <p className="text-muted-foreground italic mb-4">No dropdown items</p>
                                        )}

                                        <div className="border-t pt-3">
                                            <h5 className="font-medium mb-2">
                                                {editingDropdownIndex !== null ? 'Edit Item' : 'Add Item to Dropdown'}
                                            </h5>
                                            <div className="flex flex-col gap-2">
                                                <Input
                                                    type="text"
                                                    placeholder="Link Title"
                                                    value={editTempLinkTitle}
                                                    onChange={(e) => setEditTempLinkTitle(e.target.value)}
                                                />
                                                <div className="space-y-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id="edit-dropdown-hardcode-url"
                                                            checked={editTempLinkIsHardcoded}
                                                            onCheckedChange={(checked) => setEditTempLinkIsHardcoded(checked as boolean)}
                                                        />
                                                        <label
                                                            htmlFor="edit-dropdown-hardcode-url"
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            Hardcode URL
                                                        </label>
                                                    </div>

                                                    {editTempLinkIsHardcoded ? (
                                                        <Input
                                                            type="text"
                                                            placeholder="Link URL"
                                                            value={editTempLinkUrl}
                                                            onChange={(e) => setEditTempLinkUrl(e.target.value)}
                                                        />
                                                    ) : (
                                                        <Select value={editTempLinkSlug} onValueChange={setEditTempLinkSlug}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select a page" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {combinedPageOptions.map((opt) => (
                                                                    <SelectItem key={`opt-${opt.slug}`} value={opt.slug}>
                                                                        {opt.title.charAt(0).toUpperCase() + opt.title.slice(1)}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        onClick={handleEditAddDropdownItem}
                                                        size="sm"
                                                        className="self-start"
                                                    >
                                                        {editingDropdownIndex !== null ? 'Update Item' : 'Add Item'}
                                                    </Button>
                                                    {editingDropdownIndex !== null && (
                                                        <Button
                                                            type="button"
                                                            onClick={cancelEditingDropdownItem}
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
                                )}

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
                                    This action cannot be undone. This will permanently remove the navigation item "{itemToDelete}" from your header.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>

            <CardContent>

            {/* Current header items */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Navigation Items</h3>
                {header && header.items.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={header.items.map(item => item.title)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="border rounded divide-y">
                                {header.items.map((item) => (
                                    <SortableItem key={item.title} id={item.title}>
                                        <li className="flex justify-between items-center p-2">
                                            <div className="flex flex-1">
                                                <div>
                                                    <span className="font-medium">{item.title}</span>
                                                    {('items' in item) && <span className="ml-2 text-sm text-muted-foreground">{item.items.length} link{item.items.length == 1 ? "" : "s"}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {/* Navigate (open page in new tab) */}
                                                {(() => {
                                                    // Determine a sensible href: prefer slug when present and not hardcoded url
                                                    let href: string | null = null;
                                                    if ('items' in item) {
                                                        href = null; // dropdowns don't have direct destination
                                                    } else if ('url' in item) {
                                                        const link = item as any;
                                                        if (link.is_hardcoded_url && link.url) {
                                                            href = link.url as string;
                                                        } else if (link.slug) {
                                                            let p = link.slug as string;
                                                            if (p === "Home" || p === "") p = "/";
                                                            if (!p.startsWith("/")) p = `/${p}`;
                                                            p = p.replace(/^\/+/, "/");
                                                            href = p;
                                                        }
                                                    }
                                                    return href ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => window.open(href as string, "_blank")}
                                                            title="Open in new tab"
                                                            className="text-muted-foreground hover:text-foreground"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    ) : null;
                                                })()}
                                                <VisibilityToggle item={item} onToggle={handleChangeVisibility} />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditItem(item)}
                                                    className="text-primary hover:text-primary/80"
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveItem(item.title)}
                                                    className="text-destructive hover:text-destructive/80"
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
                    <p className="text-muted-foreground">No navigation items yet. Click "Add Navigation Item" to create one.</p>
                )}
            </div>

            {header && header.items.length > 0 && (
                <div className="flex gap-4 justify-start mt-6">
                    <Button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                    >
                        Save Changes
                    </Button>
                    {hasUnsavedChanges && (
                        <Button
                            variant="outline"
                            onClick={handleCancelChanges}
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            )}
        </CardContent>
    </Card>
    );
};

export default EditHeader;
