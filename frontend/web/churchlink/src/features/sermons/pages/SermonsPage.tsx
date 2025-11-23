import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSermons } from '@/features/sermons/api/sermonsApi';
import SermonList from '@/features/sermons/components/SermonList';
import { SermonDetailsModal } from '@/features/sermons/components/SermonDetailsModal';
import { SermonsFilterDialog } from '@/features/sermons/components/SermonsFilterDialog';
import { DEFAULT_SERMON_FILTERS } from '@/features/sermons/constants';
import { SermonFilters } from '@/features/sermons/types';
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { fetchMinistries } from '@/helpers/MinistriesHelper';
import type { Ministry } from '@/shared/types/Ministry';

const SermonsPage = () => {
    const [items, setItems] = useState<ChurchSermon[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSermon, setSelectedSermon] = useState<ChurchSermon | null>(null);
    const [filters, setFilters] = useState<SermonFilters>({ ...DEFAULT_SERMON_FILTERS });
    const [ministries, setMinistries] = useState<Ministry[]>([]);
    const { user, loading: authLoading } = useAuth();

    // Load ministries dynamically from API
    useEffect(() => {
        const loadMinistries = async () => {
            try {
                const data = await fetchMinistries();
                setMinistries(data || []);
            } catch (error) {
                console.error('Failed to load ministries', error);
                setMinistries([]);
            }
        };
        loadMinistries();
    }, []);

    const ministryNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const m of ministries) {
            if (m?.id && m?.name) map[m.id] = m.name;
        }
        return map;
    }, [ministries]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetchSermons({ published: true, limit: 100 });
                if (isMounted) {
                    setItems(res);
                }
            } catch (error) {
                console.error('Failed to load sermons', error);
                if (isMounted) {
                    setItems([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (!authLoading) {
            load();
        }

        return () => {
            isMounted = false;
        };
    }, [authLoading, user?.uid]);

    const filteredItems = useMemo(() => {
        return items.filter((sermon) => {
            const sermonMinistries = sermon.ministry || [];
            if (filters.ministry !== 'all' && !sermonMinistries.includes(filters.ministry)) {
                return false;
            }

            if (filters.title) {
                const match = sermon.title.toLowerCase().includes(filters.title.toLowerCase());
                if (!match) return false;
            }

            if (filters.speaker) {
                const match = sermon.speaker.toLowerCase().includes(filters.speaker.toLowerCase());
                if (!match) return false;
            }

            const sermonDate = sermon.date_posted instanceof Date
                ? sermon.date_posted
                : new Date(sermon.date_posted);

            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                if (sermonDate < fromDate) return false;
            }

            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                // Include the entire end day
                toDate.setHours(23, 59, 59, 999);
                if (sermonDate > toDate) return false;
            }

            if (filters.favoritesOnly && !sermon.is_favorited) {
                return false;
            }

            return true;
        });
    }, [filters, items]);

    const applyFilters = useCallback((next: SermonFilters) => {
        setFilters({ ...next });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({ ...DEFAULT_SERMON_FILTERS });
    }, []);

    const handleFavoriteToggle = useCallback((sermonId: string, isFavorited: boolean) => {
        setItems((prev) => prev.map((item) => (item.id === sermonId ? { ...item, is_favorited: isFavorited } : item)));
        setSelectedSermon((prev) => (prev && prev.id === sermonId ? { ...prev, is_favorited: isFavorited } : prev));
    }, []);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), []);

    const activeFilterLabels = useMemo(() => {
        const labels: string[] = [];
        if (filters.ministry !== 'all') {
            labels.push(`Ministry: ${filters.ministry}`);
        }
        if (filters.title.trim()) {
            labels.push(`Title: "${filters.title.trim()}"`);
        }
        if (filters.speaker.trim()) {
            labels.push(`Speaker: ${filters.speaker.trim()}`);
        }
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            labels.push(`From: ${Number.isNaN(fromDate.getTime()) ? filters.dateFrom : dateFormatter.format(fromDate)}`);
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            labels.push(`To: ${Number.isNaN(toDate.getTime()) ? filters.dateTo : dateFormatter.format(toDate)}`);
        }
        if (filters.favoritesOnly) {
            labels.push('Favorites only');
        }

        return labels;
    }, [dateFormatter, filters]);

    if (loading) return <p>Loading...</p>;

    return (
        <div className="flex justify-center bg-gray-50 py-8">
            <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Sermons</h1>
                </div>

                {/* Sermons Section */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">All Sermons</h2>
                            {activeFilterLabels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {activeFilterLabels.map((label, index) => (
                                        <span
                                            key={`sermon-filter-${index}`}
                                            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <SermonsFilterDialog
                            filters={filters}
                            availableMinistries={ministries}
                            onApply={applyFilters}
                            onReset={resetFilters}
                        />
                    </div>
                    {filteredItems.length > 0 ? (
                        <SermonList items={filteredItems} onItemClick={setSelectedSermon} ministryNameMap={ministryNameMap} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-gray-600 font-medium mb-1">No sermons found</p>
                            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                <SermonDetailsModal
                    sermon={selectedSermon}
                    isOpen={Boolean(selectedSermon)}
                    onClose={() => setSelectedSermon(null)}
                    onFavoriteToggle={handleFavoriteToggle}
                    ministryNameMap={ministryNameMap}
                />
            </div>
        </div>
    )
}

export default SermonsPage;
