import { useEffect, useMemo, useState } from "react";
import { Tag, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/shared/components/ui/dropdown-menu";
import { toast } from "react-toastify";

import type { ReadAdminPanelEvent, DiscountCode } from "@/shared/types/Event";
import { fetchAllDiscountCodes, setEventDiscountCodes } from "@/helpers/EventManagementHelper";

type Props = {
    event: ReadAdminPanelEvent;
    onSaved?: () => void;
    preferredLangCode?: string;
};

export default function AssignDiscountCodesDialog({ event, onSaved }: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingCodes, setLoadingCodes] = useState(false);

    const [allCodes, setAllCodes] = useState<DiscountCode[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(event.discount_codes ?? []);

    useEffect(() => {
        setSelectedIds(event.discount_codes ?? []);
    }, [event.id, event.discount_codes]);

    useEffect(() => {
        if (!open) return;
        let mounted = true;
        (async () => {
            setLoadingCodes(true);
            try {
                const codes = await fetchAllDiscountCodes();
                if (mounted) setAllCodes(codes ?? []);
            } catch {
                alert("Failed to load discount codes.");
            } finally {
                if (mounted) setLoadingCodes(false);
            }
        })();
        return () => { mounted = false; };
    }, [open]);

    const toggle = (id: string) => {
        setSelectedIds((prev) => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return Array.from(s);
        });
    };

    const displayFor = (c: DiscountCode) => (c.code && c.name ? `CODE: ${c.code}` : c.code || c.name || c.id);
    const sortedOptions = useMemo(() => [...allCodes].sort((a, b) => displayFor(a).localeCompare(displayFor(b))), [allCodes]);

    const handleClose = () => {
        setOpen(false);
        setSelectedIds(event.discount_codes ?? []);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await setEventDiscountCodes(event.id, selectedIds);
            if (!res?.success) {
                alert(res?.msg || "Failed to set discount codes.");
                return;
            }
            toast.success(res?.msg || "Discount codes updated.");
            setOpen(false);
            onSaved?.();
        } catch {
            alert("Failed to set discount codes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Button to open Dialog */}
            <Button
                variant="ghost"
                size="icon"
                title="Assign discount codes"
                aria-label="Assign discount codes"
                onClick={() => setOpen(true)}
            >
                <Tag className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
                <DialogContent className="max-w-2xl w-full max-h-screen flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign Discount Codes</DialogTitle>
                        <DialogDescription>
                            Choose which discount codes should be associated with <b>{event.default_title}</b>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <label className="font-semibold">Codes:</label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex items-center gap-2 dark:hover:bg-muted dark:hover:text-foreground focus-visible:ring-1 focus-visible:ring-border"
                                        disabled={loadingCodes}
                                    >
                                        {loadingCodes ? (
                                            <>
                                                <Loader2 className="animate-spin h-4 w-4" />
                                                Loading…
                                            </>
                                        ) : (
                                            <>
                                                {selectedIds.length ? `${selectedIds.length} selected` : "Select discount codes"}
                                                <ChevronDown className="h-4 w-4" />
                                            </>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="start" className="z-[700] max-h-[50vh] overflow-y-auto">
                                    {sortedOptions.map((c) => {
                                        const checked = selectedIds.includes(c.id);
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={c.id}
                                                checked={checked}
                                                onCheckedChange={() => toggle(c.id)}
                                            >
                                                {displayFor(c)}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                                    {sortedOptions.length === 0 && !loadingCodes && (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">No discount codes found.</div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {selectedIds.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} disabled={saving}>
                                    Clear
                                </Button>
                            )}
                        </div>

                        <div className="border border-border rounded-lg p-3 bg-muted/30 text-sm">
                            <div className="font-semibold mb-1">Selected</div>
                            {selectedIds.length === 0 ? (
                                <div className="text-muted-foreground">No codes selected.</div>
                            ) : (
                                <ul className="list-disc ml-5 space-y-1">
                                    {selectedIds.map((id) => {
                                        const code = allCodes.find((c) => c.id === id);
                                        return <li key={id}>{code ? displayFor(code) : id}</li>;
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
                        <Button variant="default" onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Saving…
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
