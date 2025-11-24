import { useMemo, useState } from 'react';
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

export interface ServiceFilters {
    dayOfWeek: string;
    timeRange: string;
    title: string;
}

const DAYS_OF_WEEK = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

const TIME_RANGES = [
    { value: 'morning', label: 'Morning (6AM - 12PM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 6PM)' },
    { value: 'evening', label: 'Evening (6PM - 12AM)' },
];

interface ServicesFilterDialogProps {
    filters: ServiceFilters;
    onApply: (next: ServiceFilters) => void;
    onReset: () => void;
}

export function ServicesFilterDialog({ filters, onApply, onReset }: ServicesFilterDialogProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ServiceFilters>(filters);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.dayOfWeek !== 'all') count += 1;
        if (filters.timeRange !== 'all') count += 1;
        if (filters.title.trim()) count += 1;
        return count;
    }, [filters]);

    const updateDraft = <K extends keyof ServiceFilters>(key: K, value: ServiceFilters[K]) => {
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
        const defaultFilters: ServiceFilters = {
            dayOfWeek: 'all',
            timeRange: 'all',
            title: '',
        };
        setDraft(defaultFilters);
        // Close dialog immediately after reset
        setOpen(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            // Reset draft to current filters when closing without applying
            setDraft({ ...filters });
        } else {
            // Sync draft with current filters when opening
            setDraft({ ...filters });
        }
        setOpen(next);
    };

    const isDirty = useMemo(() => {
        return (
            draft.dayOfWeek !== filters.dayOfWeek ||
            draft.timeRange !== filters.timeRange ||
            draft.title !== filters.title
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
                    <DialogTitle>Filter services</DialogTitle>
                    <DialogDescription>
                        Refine the service list by day of week, time of day, and title.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="service-filter-day">Day of Week</Label>
                            <Select
                                value={draft.dayOfWeek}
                                onValueChange={(value) => updateDraft('dayOfWeek', value)}
                            >
                                <SelectTrigger id="service-filter-day" className="w-full">
                                    <SelectValue placeholder="All days" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All days</SelectItem>
                                    {DAYS_OF_WEEK.map((day) => (
                                        <SelectItem key={day} value={day}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="service-filter-time">Time of Day</Label>
                            <Select
                                value={draft.timeRange}
                                onValueChange={(value) => updateDraft('timeRange', value)}
                            >
                                <SelectTrigger id="service-filter-time" className="w-full">
                                    <SelectValue placeholder="All times" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All times</SelectItem>
                                    {TIME_RANGES.map((range) => (
                                        <SelectItem key={range.value} value={range.value}>
                                            {range.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="service-filter-title">Title</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="service-filter-title"
                                    placeholder="Search by title"
                                    className="pl-9"
                                    value={draft.title}
                                    onChange={(event) => updateDraft('title', event.target.value)}
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
