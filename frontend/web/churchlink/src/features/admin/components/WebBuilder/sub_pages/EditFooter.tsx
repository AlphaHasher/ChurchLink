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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import MultiStateBadge from "@/shared/components/MultiStageBadge";
import { useLanguage } from "@/provider/LanguageProvider";

interface FooterItem {
    title: string;
    titles?: Record<string, string>;
    url: string | null;
    visible?: boolean;
}

interface FooterSection {
    title: string;
    titles?: Record<string, string>;
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
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
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

interface EditFooterProps {
    onFooterDataChange?: (data: FooterSection[]) => void;
}

const EditFooter = ({ onFooterDataChange }: EditFooterProps = {}) => {
    const [footer, setFooter] = useState<Footer | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const { siteLocales, addSiteLocale, refreshSiteLocales } = useLanguage();
    const [addLocaleOpen, setAddLocaleOpen] = useState(false);
    const [footerLocale, setFooterLocale] = useState<string>('en');

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        fetchFooter();
    }, []);

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
            const currentTitles = footer.items.map(item => item.title);
            await api.put("/v1/footer/reorder", { titles: currentTitles });
            toast.success("Footer changes saved successfully");
            await fetchFooter();
        } catch (err) {
            console.error("Failed to save footer changes:", err);
            toast.error("Failed to save changes");
            await fetchFooter();
        }
    };

    const handleChangeVisibility = (title: string, currentVisibility: boolean) => {
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
                    <div className="flex items-center gap-2">
                        <Select value={footerLocale} onValueChange={async (val) => { setFooterLocale(val); await ensureFooterLocale(footer?.items || [], val); }}>
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
                                const items = collectFooterTitles(footer?.items || []);
                                if (!items.length) return;
                                setLoading(true);
                                try {
                                    await translateStrings(items, [code], 'en');
                                    await seedGlobalTranslations(code, 'footer');
                                    toast.success(`Locale "${code}" translations seeded for footer`);
                                    setFooterLocale(code);
                                    await ensureFooterLocale(footer?.items || [], code);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                    </div>
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
                                                    {('url' in item) && <span className="ml-2 text-sm text-gray-500">{(item as FooterItem).url}</span>}
                                                    {('items' in item) && <span className="ml-2 text-sm text-gray-500">{item.items.length} item{item.items.length == 1 ? "" : "s"}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <FooterVisibilityToggle section={item} onToggle={handleChangeVisibility} />
                                            </div>
                                        </li>
                                    </SortableItem>
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <p className="text-gray-500">No sections yet. Click "Add Section" to create one.</p>
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
