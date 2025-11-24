import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/components/ui/Dialog';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';

export interface BulletinFilters {
    ministry: string;
    headline: string;
}

export const DEFAULT_BULLETIN_FILTERS: BulletinFilters = {
    ministry: 'all',
    headline: '',
};

interface MinistryOption {
    id: string;
    name: string;
}

interface BulletinsFilterDialogProps {
    filters: BulletinFilters;
    availableMinistries: MinistryOption[];
    onApply: (next: BulletinFilters) => void;
    onReset: () => void;
}

export function BulletinsFilterDialog({ filters, availableMinistries, onApply, onReset }: BulletinsFilterDialogProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<BulletinFilters>(filters);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.ministry !== 'all') count += 1;
        if (filters.headline.trim()) count += 1;
        return count;
    }, [filters]);

    useEffect(() => {
        if (open) {
            setDraft(filters);
        }
    }, [filters, open]);

    const updateDraft = <K extends keyof BulletinFilters>(key: K, value: BulletinFilters[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const handleApply = () => {
        onApply(draft);
        setOpen(false);
    };

    const handleReset = () => {
        // Reset filters to default which triggers immediate data reload
        onReset();
        // Update draft state to reflect the reset
        setDraft({ ...DEFAULT_BULLETIN_FILTERS });
        // Close dialog immediately after reset
        setOpen(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setDraft(filters);
        }
        setOpen(next);
    };

    const isDirty = useMemo(() => {
        return (
            draft.ministry !== filters.ministry ||
            draft.headline !== filters.headline
        );
    }, [draft, filters]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <Search className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Filter bulletins</DialogTitle>
                    <DialogDescription>
                        Refine the bulletin list by combining ministry, title, and date range.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="bulletin-filter-ministry">Ministry</Label>
                            <Select
                                value={draft.ministry}
                                onValueChange={(value) => updateDraft('ministry', value)}
                            >
                                <SelectTrigger id="bulletin-filter-ministry" className="w-full">
                                    <SelectValue placeholder="All ministries" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All ministries</SelectItem>
                                    {availableMinistries.map((ministry) => (
                                        <SelectItem key={ministry.id} value={ministry.id}>
                                            {ministry.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="bulletin-filter-title">Title</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="bulletin-filter-title"
                                    placeholder="Search by title"
                                    className="pl-9"
                                    value={draft.headline}
                                    onChange={(event) => updateDraft('headline', event.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={activeFilterCount === 0}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset filters
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleApply} disabled={!isDirty}>
                            Apply filters
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
