import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, Users } from 'lucide-react';

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
import { Checkbox } from '@/shared/components/ui/checkbox';
import type { Ministry } from '@/shared/types/Ministry';

import { SermonFilters } from '../types';
import { DEFAULT_SERMON_FILTERS } from '../constants';

interface SermonsFilterDialogProps {
    filters: SermonFilters;
    availableMinistries: Ministry[];
    onApply: (next: SermonFilters) => void;
    onReset: () => void;
}

export function SermonsFilterDialog({ filters, availableMinistries, onApply, onReset }: SermonsFilterDialogProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<SermonFilters>(filters);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.ministry !== 'all') count += 1;
        if (filters.title.trim()) count += 1;
        if (filters.speaker.trim()) count += 1;
        if (filters.dateFrom) count += 1;
        if (filters.dateTo) count += 1;
        if (filters.favoritesOnly) count += 1;
        return count;
    }, [filters]);

    useEffect(() => {
        if (open) {
            setDraft(filters);
        }
    }, [filters, open]);

    const updateDraft = <K extends keyof SermonFilters>(key: K, value: SermonFilters[K]) => {
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
        setDraft({ ...DEFAULT_SERMON_FILTERS });
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
            draft.title !== filters.title ||
            draft.speaker !== filters.speaker ||
            draft.dateFrom !== filters.dateFrom ||
            draft.dateTo !== filters.dateTo ||
            draft.favoritesOnly !== filters.favoritesOnly
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
            <DialogContent className="w-full max-w-2xl z-[999]">
                <DialogHeader>
                    <DialogTitle>Filter sermons</DialogTitle>
                    <DialogDescription>
                        Refine the sermon list by combining ministry, speaker, date range, and favorites preferences.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="sermon-filter-ministry">Ministry</Label>
                            <Select
                                value={draft.ministry}
                                onValueChange={(value) => updateDraft('ministry', value)}
                            >
                                <SelectTrigger id="sermon-filter-ministry" className="w-full">
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
                            <Label htmlFor="sermon-filter-speaker">Speaker</Label>
                            <div className="relative">
                                <Users className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="sermon-filter-speaker"
                                    placeholder="Search by speaker"
                                    className="pl-9"
                                    value={draft.speaker}
                                    onChange={(event) => updateDraft('speaker', event.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="sermon-filter-title">Title</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="sermon-filter-title"
                                    placeholder="Search by title"
                                    className="pl-9"
                                    value={draft.title}
                                    onChange={(event) => updateDraft('title', event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sermon-filter-favorites">Favorites</Label>
                            <div className="flex items-center justify-between rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Favorites only</span>
                                    <span className="text-xs text-muted-foreground">Show sermons you&apos;ve starred.</span>
                                </div>
                                <Checkbox
                                    id="sermon-filter-favorites"
                                    checked={draft.favoritesOnly}
                                    onCheckedChange={(checked) => updateDraft('favoritesOnly', Boolean(checked))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="sermon-filter-start">Start date</Label>
                            <Input
                                id="sermon-filter-start"
                                type="date"
                                value={draft.dateFrom}
                                onChange={(event) => updateDraft('dateFrom', event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="sermon-filter-end">End date</Label>
                            <Input
                                id="sermon-filter-end"
                                type="date"
                                value={draft.dateTo}
                                onChange={(event) => updateDraft('dateTo', event.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="ghost" className="gap-2" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4" />
                        Reset filters
                    </Button>
                    <div className="flex w-full justify-end gap-2 sm:w-auto">
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
