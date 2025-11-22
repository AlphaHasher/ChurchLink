import { useState, useEffect, useMemo, useCallback } from "react";
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
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import MultiStateBadge from "@/shared/components/MultiStageBadge";
import { useLanguage } from "@/provider/LanguageProvider";
import { AddLocaleDialog, collectTitles, translateMissingStrings } from "@/shared/utils/localizationUtils";
import LocaleSelect from "@/shared/components/LocaleSelect";

interface FooterItem {
    titles: Record<string, string>;
    url?: string | null;
    slug?: string;
    is_hardcoded_url?: boolean;
    visible?: boolean;
}

// For editing purposes, we add a displayTitle field
interface EditingFooterItem extends FooterItem {
    displayTitle: string; // For UI display during editing
}

interface FooterSection {
    titles: Record<string, string>;
    items: FooterItem[];
    visible?: boolean;
}

interface Footer {
    items: FooterSection[];
}

const FooterVisibilityToggle: React.FC<{ section: FooterSection; onToggle: (title: string, currentVisibility: boolean) => void }> = ({ section, onToggle }) => {
    const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

    const handleToggleVisibility = async () => {
        if (badgeState !== "custom") return;
        const currentVisibility = section.visible ?? false;
        const newVisibility = !currentVisibility;
        setBadgeState("processing");

        try {
            await api.put(`/v1/footer/${section.titles.en}/visibility`, { visible: newVisibility });
            setBadgeState("success");
            setTimeout(() => {
                onToggle(section.titles.en, currentVisibility);
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
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
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
    const [translationLoading, setTranslationLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const { languages, setLocale, locale: globalLocale } = useLanguage();
    const [addLocaleOpen, setAddLocaleOpen] = useState(false);
    const [footerLocale, setFooterLocale] = useState<string>(globalLocale || 'en');
    const [availableLocales, setAvailableLocales] = useState<string[]>(['en']);
    const [translationCache, setTranslationCache] = useState<Record<string, Record<string, string>>>({});

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSection, setEditingSection] = useState<FooterSection | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editPlaceholder, setEditPlaceholder] = useState("");
    const [editItems, setEditItems] = useState<Array<EditingFooterItem>>([]);
    const [editItemTitle, setEditItemTitle] = useState("");
    const [editItemUrl, setEditItemUrl] = useState("");
    const [editItemSlug, setEditItemSlug] = useState("");
    const [editItemIsHardcoded, setEditItemIsHardcoded] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addTitleEn, setAddTitleEn] = useState("");
    const [addItems, setAddItems] = useState<Array<{ id: string; titleEn: string; url?: string; slug?: string; is_hardcoded_url?: boolean }>>([]);
    const [addItemTitleEn, setAddItemTitleEn] = useState("");
    const [addItemUrl, setAddItemUrl] = useState("");
    const [addItemSlug, setAddItemSlug] = useState("");
    const [addItemIsHardcoded, setAddItemIsHardcoded] = useState(false);

    const [pages, setPages] = useState<Array<{ _id: string; title: string; slug: string; visible: boolean }>>([]);

    const sensors = useSensors(useSensor(PointerSensor));

    const defaultPublicRoutes = useMemo(
        () => [
            { slug: "live", title: "Live" },
            { slug: "events", title: "Events" },
            { slug: "sermons", title: "Sermons" },
            { slug: "weekly-bulletin", title: "Weekly Bulletin" },
        ],
        []
    );

    const combinedPageOptions = useMemo(() => {
        const options: { slug: string; title: string }[] = [];
        const seen = new Set<string>();

        for (const r of defaultPublicRoutes) {
            if (!r.slug.includes(":")) {
                options.push({ slug: r.slug, title: r.title });
                seen.add(r.slug);
            }
        }

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

    const localeOptions = useMemo(() => {
        const localeSet = new Set<string>(availableLocales && availableLocales.length ? availableLocales : ['en']);
        if (footer?.items) {
            footer.items.forEach(section => {
                if (section.titles) {
                    Object.keys(section.titles).forEach(code => localeSet.add(code));
                }
                section.items.forEach(item => {
                    if (item.titles) {
                        Object.keys(item.titles).forEach(code => localeSet.add(code));
                    }
                });
            });
        }
        return Array.from(localeSet);
    }, [availableLocales, footer]);

    useEffect(() => {
        void fetchFooter();
        void fetchLocales();
        void fetchPages();
    }, []);

    // Sync footerLocale with global locale from LanguageProvider
    useEffect(() => {
        if (globalLocale && globalLocale !== footerLocale) {
            setFooterLocale(globalLocale);
        }
    }, [globalLocale]);

    const fetchPages = async () => {
        try {
            const response = await api.get("/v1/pages/");
            setPages(response.data);
        } catch (error) {
            console.error("Error fetching pages:", error);
        }
    };

    const fetchLocales = async () => {
        try {
            const response = await api.get("/v1/footer/locales");
            const locales = response?.data?.locales;
            if (Array.isArray(locales) && locales.length) {
                setAvailableLocales(locales);
                if (!locales.includes(footerLocale)) {
                    setFooterLocale(locales[0] || 'en');
                }
            }
        } catch (error) {
            console.error("Error fetching footer locales:", error);
        }
    };

    const ensureLocaleTranslations = useCallback(async (localeCode: string) => {
        if (!localeCode || localeCode === 'en') return;
        if (!footer?.items?.length) return;

        const englishStrings = collectTitles(footer.items as any);
        const cached = translationCache[localeCode] || {};
        const translated = await translateMissingStrings(englishStrings, localeCode, cached);
        if (translated === cached) return;
        setTranslationCache((prev) => ({
            ...prev,
            [localeCode]: translated,
        }));
    }, [footer?.items, translationCache]);

    useEffect(() => {
        if (!footer?.items?.length) return;
        if (footerLocale === 'en') return;
        void ensureLocaleTranslations(footerLocale);
    }, [footerLocale, footer?.items, ensureLocaleTranslations]);

    const getDisplayTitle = useCallback((section: FooterSection): string => {
        const english = section.titles?.en || '';
        if (footerLocale === 'en') return english;
        const saved = section.titles?.[footerLocale];
        if (saved) return saved;
        if (!english) return '';
        return translationCache[footerLocale]?.[english] || english;
    }, [footerLocale, translationCache]);

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
            // Don't show error toast if footer doesn't exist - it's optional
            // Only log to console for debugging
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!footer) return;

        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = footer.items.findIndex(item => item.titles.en === active.id);
            const newIndex = footer.items.findIndex(item => item.titles.en === over?.id);

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
            const currentTitles = footer.items.map(item => item.titles.en);
            await api.put("/v1/footer/reorder", { titles: currentTitles });
            toast.success("Footer changes saved successfully");
            await fetchFooter();
        } catch (err) {
            console.error("Failed to save footer changes:", err);
            toast.error("Failed to save changes");
            await fetchFooter();
        }
    };

    const handleAddItemToNewSection = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!addItemTitleEn) {
            toast.error("Item title (English) is required");
            return;
        }

        const newItem: any = {
            id: `${Date.now()}-${Math.random()}`,
            titleEn: addItemTitleEn,
            is_hardcoded_url: addItemIsHardcoded,
        };

        if (addItemIsHardcoded && addItemUrl) {
            newItem.url = addItemUrl;
        } else if (!addItemIsHardcoded && addItemSlug) {
            newItem.slug = addItemSlug;
        }

        setAddItems((prev) => [...prev, newItem]);
        setAddItemTitleEn("");
        setAddItemUrl("");
        setAddItemSlug("");
        setAddItemIsHardcoded(false);
    };

    const handleRemoveAddItem = (id: string) => {
        setAddItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleAddSectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addTitleEn) {
            toast.error("Section English title is required");
            return;
        }
        if (!addItems.length) {
            toast.error("Add at least one item to the section");
            return;
        }
        try {
            const payload = {
                title: addTitleEn,
                titles: { en: addTitleEn },
                items: addItems.map((it) => ({
                    title: it.titleEn,
                    titles: { en: it.titleEn },
                    is_hardcoded_url: it.is_hardcoded_url || false,
                    url: it.is_hardcoded_url ? it.url : undefined,
                    slug: it.is_hardcoded_url ? undefined : it.slug,
                    visible: true,
                })),
                visible: false,
            } as any;

            const res = await api.post("/v1/footer/items", payload);
            if (res?.data?.success) {
                toast.success("Section added successfully");
                setIsAddModalOpen(false);
                setAddTitleEn("");
                setAddItems([]);
                await fetchFooter();
            } else {
                const msg = res?.data?.msg || "Failed to add section";
                toast.error(msg);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.msg || err?.message || "Failed to add section";
            toast.error(msg);
        }
    };

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
        if (footer) {
            const newItems = footer.items.map(item =>
                item.titles.en === title ? { ...item, visible: !currentVisibility } : item
            );
            setFooter({ ...footer, items: newItems });
        }
    };

    const handleRemoveSection = (title: string) => {
        setSectionToDelete(title);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteSection = async () => {
        if (!sectionToDelete) return;

        try {
            await api.delete(`/v1/footer/${sectionToDelete}`);
            toast.success(`"${sectionToDelete}" removed successfully`);

            if (footer) {
                // Update UI after successful deletion
                const newItems = footer.items.filter(item => item.titles.en !== sectionToDelete);
                setFooter({ ...footer, items: newItems });
            }

            // Refresh data from server to ensure consistency
            await fetchFooter();
        } catch (err) {
            console.error("Failed to remove footer section:", err);
            toast.error(`Failed to remove "${sectionToDelete}"`);
            // Refresh to revert any optimistic UI updates
            await fetchFooter();
        } finally {
            setIsDeleteModalOpen(false);
            setSectionToDelete(null);
        }
    };

    const handleEditSection = (section: FooterSection) => {
        setEditingSection(section);
        const english = section.titles?.en || '';
        const savedLocale = section.titles?.[footerLocale];
        if (footerLocale === 'en') {
            setEditTitle(english);
            setEditPlaceholder(english);
        } else if (savedLocale && String(savedLocale).trim()) {
            setEditTitle(savedLocale);
            setEditPlaceholder(savedLocale);
        } else {
            const autoTranslation = translationCache[footerLocale]?.[english] || english;
            setEditTitle(autoTranslation);
            setEditPlaceholder(autoTranslation);
        }
        // Map items to show the current locale's title
        const mappedItems = section.items.map((item: any): EditingFooterItem => {
            const itemEnglish = item.titles?.en;
            const itemSavedLocale = item.titles?.[footerLocale];
            let displayTitle = "";
            if (footerLocale === 'en') {
                displayTitle = itemEnglish || "";
            } else if (itemSavedLocale && String(itemSavedLocale).trim()) {
                displayTitle = itemSavedLocale;
            } else {
                displayTitle = translationCache[footerLocale]?.[itemEnglish] || itemEnglish || "";
            }
            return {
                titles: item.titles || { en: "" },
                displayTitle,
                url: item.url || null,
                slug: item.slug || "",
                is_hardcoded_url: item.is_hardcoded_url || false,
                visible: item.visible !== false,
            };
        });
        setEditItems(mappedItems);
        setIsEditModalOpen(true);
    };

    const handleEditAddItem = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!editItemTitle) {
            toast.error("Item title is required");
            return;
        }

        const itemData: EditingFooterItem = {
            titles: { en: editItemTitle },
            displayTitle: editItemTitle,
            is_hardcoded_url: editItemIsHardcoded,
            visible: true,
        };

        if (editItemIsHardcoded && editItemUrl) {
            itemData.url = editItemUrl;
        } else if (!editItemIsHardcoded && editItemSlug) {
            itemData.slug = editItemSlug;
        }

        if (editingItemIndex !== null) {
            // Update existing item
            const updatedItems = [...editItems];
            updatedItems[editingItemIndex] = itemData;
            setEditItems(updatedItems);
            setEditingItemIndex(null);
        } else {
            // Add new item
            setEditItems([...editItems, itemData]);
        }

        setEditItemTitle("");
        setEditItemUrl("");
        setEditItemSlug("");
        setEditItemIsHardcoded(false);
    };

    const handleEditItemInList = (index: number) => {
        const item = editItems[index];
        setEditItemTitle(item.displayTitle);
        setEditItemUrl(item.url || "");
        setEditItemSlug(item.slug || "");
        setEditItemIsHardcoded(item.is_hardcoded_url || false);
        setEditingItemIndex(index);
    };

    const handleRemoveEditItem = (index: number) => {
        setEditItems(editItems.filter((_, i) => i !== index));
        if (editingItemIndex === index) {
            setEditItemTitle("");
            setEditItemUrl("");
            setEditItemSlug("");
            setEditItemIsHardcoded(false);
            setEditingItemIndex(null);
        }
    };

    const cancelEditingItem = () => {
        setEditItemTitle("");
        setEditItemUrl("");
        setEditItemSlug("");
        setEditItemIsHardcoded(false);
        setEditingItemIndex(null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSection) return;
        if (!editTitle) {
            toast.error("Title is required");
            return;
        }
        try {
            const existingTitles = (editingSection.titles || {}) as Record<string, string>;
            const nextTitles: Record<string, string> = { ...existingTitles };
            const localeKey = footerLocale === 'en' ? 'en' : footerLocale;
            nextTitles[localeKey] = editTitle;

            const updatedSection: any = {
                titles: nextTitles,
                items: editItems.map((item, idx) => {
                    const original = editingSection.items?.[idx];
                    const baseTitles = ((original?.titles || item.titles) || {}) as Record<string, string>;
                    const newTitles: Record<string, string> = { ...baseTitles };
                    const itemLocaleKey = footerLocale === 'en' ? 'en' : footerLocale;
                    newTitles[itemLocaleKey] = item.displayTitle;
                    return {
                        titles: newTitles,
                        is_hardcoded_url: item.is_hardcoded_url || false,
                        url: item.is_hardcoded_url ? item.url : undefined,
                        slug: item.is_hardcoded_url ? undefined : item.slug,
                        visible: item.visible !== false,
                    };
                }),
            };

            const response = await api.put(`/v1/footer/items/edit/${editingSection.titles.en}`, updatedSection);
            if (response?.data?.success) {
                toast.success("Footer section updated successfully");
                setIsEditModalOpen(false);
                setEditingSection(null);
                await fetchFooter();
            } else {
                const errorMsg = response?.data?.msg || "Failed to update footer section";
                toast.error(errorMsg);
            }
        } catch (err: any) {
            const errorMsg = err?.response?.data?.msg || err?.response?.data?.message || err?.message || "Failed to update footer section";
            toast.error(errorMsg);
        }
    };

    if (loading) return <div className="p-6 text-center">Loading footer data...</div>;

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Edit Footer Sections</CardTitle>
                    <div className="flex items-center gap-2">
                        <LocaleSelect
                            value={footerLocale}
                            locales={localeOptions}
                            languages={languages}
                            isBusy={translationLoading}
                            onChange={async (val) => {
                                if (val === footerLocale) return;
                                setTranslationLoading(true);
                                try {
                                    await ensureLocaleTranslations(val);
                                    setFooterLocale(val);
                                    setLocale(val);
                                } finally {
                                    setTranslationLoading(false);
                                }
                            }}
                        />
                        <AddLocaleDialog
                            open={addLocaleOpen}
                            onOpenChange={setAddLocaleOpen}
                            siteLocales={localeOptions || ['en']}
                            onAddLocale={async (code: string) => {
                                setTranslationLoading(true);
                                try {
                                    await api.post("/v1/footer/locales", { code });
                                    await fetchLocales();
                                    await ensureLocaleTranslations(code);
                                    setFooterLocale(code);
                                    setLocale(code);
                                    toast.success(`Locale "${code}" added for footer`);
                                } catch (error) {
                                    console.error('Error adding locale:', error);
                                    toast.error(`Failed to add locale "${code}"`);
                                } finally {
                                    setTranslationLoading(false);
                                }
                            }}
                        />

                        {/* right-side locale controls only; add button sits as sibling below */}
                    </div>
                    {/* Add Section - aligned like header's Add button */}
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
                                    Create a new footer section with links. English titles are required.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddSectionSubmit} className="flex flex-col gap-4">
                                <Input
                                    type="text"
                                    placeholder="Section Title (English)"
                                    value={addTitleEn}
                                    onChange={(e) => setAddTitleEn(e.target.value)}
                                    required
                                />

                                <div className="border rounded p-4">
                                    <h4 className="font-medium mb-2">Section Items</h4>

                                    {addItems.length > 0 ? (
                                        <ul className="mb-4 space-y-2">
                                            {addItems.map((item) => (
                                                <li key={item.id} className="flex justify-between items-center p-2 bg-card border rounded">
                                                    <div>
                                                        <div className="font-medium">{item.titleEn}</div>
                                                        <div className="text-sm text-primary">{item.is_hardcoded_url ? item.url : item.slug}</div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveAddItem(item.id)}
                                                        className="text-destructive hover:text-destructive/80"
                                                    >
                                                        Remove
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-muted-foreground italic mb-4">No links</p>
                                    )}

                                    <div className="border-t pt-3">
                                        <h5 className="font-medium mb-2">Add Item to Section</h5>
                                        <div className="flex flex-col gap-2">
                                            <Input
                                                type="text"
                                                placeholder="Item Title (English)"
                                                value={addItemTitleEn}
                                                onChange={(e) => setAddItemTitleEn(e.target.value)}
                                            />
                                            <div className="space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="add-hardcode-url"
                                                        checked={addItemIsHardcoded}
                                                        onCheckedChange={(checked) => setAddItemIsHardcoded(checked as boolean)}
                                                    />
                                                    <label
                                                        htmlFor="add-hardcode-url"
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        Hardcode URL
                                                    </label>
                                                </div>

                                                {addItemIsHardcoded ? (
                                                    <Input
                                                        type="text"
                                                        placeholder="Item URL"
                                                        value={addItemUrl}
                                                        onChange={(e) => setAddItemUrl(e.target.value)}
                                                    />
                                                ) : (
                                                    <Select value={addItemSlug} onValueChange={setAddItemSlug}>
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
                                                onClick={handleAddItemToNewSection}
                                                size="sm"
                                                className="self-start"
                                            >
                                                Add to Section
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={!addItems.length}>Add Section</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>

            <CardContent>
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Sections</h3>
                {footer && footer.items.length > 0 ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={footer.items.map(item => item.titles.en)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="border rounded divide-y">
                                {footer.items.map((item) => (
                                    <SortableItem key={item.titles.en} id={item.titles.en}>
                                        <li className="flex justify-between items-center p-2">
                                            <div className="flex flex-1">
                                                <div>
                                                    <span className="font-medium">
                                                        {getDisplayTitle(item)}
                                                    </span>
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
                                                    className="text-primary hover:text-primary/80"
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveSection(item.titles.en)}
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
                    <p className="text-muted-foreground">No sections yet. Click "Add Section" to create one.</p>
                )}
            </div>

            {/* Edit Section Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Footer Section</DialogTitle>
                        <DialogDescription>
                            Update the section title and items. Only the current locale will be changed.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                        <Input
                            type="text"
                            placeholder={editPlaceholder || "Title"}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="placeholder:text-muted-foreground/70"
                            required
                        />

                        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                            <h4 className="font-medium mb-2">Section Items</h4>

                            {editItems.length > 0 ? (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={editItems.map((item, idx) => `${item.displayTitle}-${idx}`)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <ul className="mb-4">
                                            {editItems.map((item, index) => (
                                                <SortableItem key={`${item.displayTitle}-${index}`} id={`${item.displayTitle}-${index}`}>
                                                    <li className="flex justify-between items-center p-2 bg-card border rounded">
                                                        <div>
                                                            <div className="font-medium">{item.displayTitle}</div>
                                                            <div className="text-sm text-primary">{item.is_hardcoded_url ? item.url : item.slug}</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEditItemInList(index)}
                                                                className="text-primary hover:text-primary/80"
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRemoveEditItem(index)}
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
                                <p className="text-muted-foreground italic mb-4">No items</p>
                            )}

                            <div className="border-t pt-3">
                                <h5 className="font-medium mb-2">
                                    {editingItemIndex !== null ? 'Edit Item' : 'Add Item to Section'}
                                </h5>
                                <div className="flex flex-col gap-2">
                                    <Input
                                        type="text"
                                        placeholder="Item Title"
                                        value={editItemTitle}
                                        onChange={(e) => setEditItemTitle(e.target.value)}
                                    />
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-hardcode-url"
                                                checked={editItemIsHardcoded}
                                                onCheckedChange={(checked) => setEditItemIsHardcoded(checked as boolean)}
                                            />
                                            <label
                                                htmlFor="edit-hardcode-url"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Hardcode URL
                                            </label>
                                        </div>

                                        {editItemIsHardcoded ? (
                                            <Input
                                                type="text"
                                                placeholder="Item URL"
                                                value={editItemUrl}
                                                onChange={(e) => setEditItemUrl(e.target.value)}
                                            />
                                        ) : (
                                            <Select value={editItemSlug} onValueChange={setEditItemSlug}>
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
                            <Button type="submit">Save Changes</Button>
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
                            This action cannot be undone. This will permanently remove the footer section "{sectionToDelete}" from your website.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDeleteSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
