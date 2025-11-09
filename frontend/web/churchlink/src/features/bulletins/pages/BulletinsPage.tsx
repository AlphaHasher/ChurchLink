import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fetchCombinedFeed } from '@/features/bulletins/api/bulletinsApi';
import BulletinList from '@/features/bulletins/components/BulletinList';
import { ServiceCard } from '@/features/bulletins/components/ServiceCard';
import { BulletinDetailsModal } from '@/features/bulletins/components/BulletinDetailsModal';
import { BulletinsFilterDialog, DEFAULT_BULLETIN_FILTERS, BulletinFilters } from '@/features/bulletins/components/BulletinsFilterDialog';
import { ChurchBulletin, ServiceBulletin, BulletinFilter, DEFAULT_BULLETIN_LIMIT } from '@/shared/types/ChurchBulletin';
import { useAuth } from '@/features/auth/hooks/auth-context';

/**
 * Get the Monday of the current week at 00:00:00
 * Used ONLY for filtering services by week (services still use week-based display_week)
 * Bulletins now use exact date filtering instead
 */
const getCurrentWeekMonday = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust Sunday to be 6 days from Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
};

/**
 * Get the Sunday of the current week at 23:59:59
 */
const getCurrentWeekSunday = (): Date => {
    const monday = getCurrentWeekMonday();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
};

const BulletinsPage = () => {
    const [bulletinItems, setBulletinItems] = useState<ChurchBulletin[]>([]);
    const [serviceItems, setServiceItems] = useState<ServiceBulletin[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBulletin, setSelectedBulletin] = useState<ChurchBulletin | null>(null);
    const [selectedService, setSelectedService] = useState<ServiceBulletin | null>(null);
    const [filters, setFilters] = useState<BulletinFilters>({ ...DEFAULT_BULLETIN_FILTERS });
    const { user, loading: authLoading } = useAuth();

    // Load data whenever filters change
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                console.log(`[Bulletins Page] Loading feed with filters at ${new Date().toISOString()}`, filters);
                
                // Get current week boundaries for service filtering ONLY
                // Services still use week-based display_week, bulletins use exact dates
                const weekStart = getCurrentWeekMonday();
                const weekEnd = getCurrentWeekSunday();
                
                console.log(`[Bulletins Page] Filtering services for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
                
                // Convert filters to API format
                // IMPORTANT: week_start/week_end are sent to the API but the backend will IGNORE them for bulletins
                // when upcoming_only=true. The backend uses week filters ONLY for services.
                const apiFilters: BulletinFilter = {
                    published: true,
                    limit: DEFAULT_BULLETIN_LIMIT,
                    // Use upcoming_only for bulletins (date-based filtering: publish_date <= today)
                    upcoming_only: true,
                    // These week filters apply ONLY to services, NOT bulletins (backend ignores them for bulletins)
                    week_start: weekStart.toISOString().split('T')[0], // Format as YYYY-MM-DD
                    week_end: weekEnd.toISOString().split('T')[0],
                };

                if (filters.ministry !== 'all') {
                    apiFilters.ministry = filters.ministry;
                }

                if (filters.headline.trim()) {
                    apiFilters.query = filters.headline.trim();
                }

                const feed = await fetchCombinedFeed(apiFilters);
                if (isMounted) {
                    setBulletinItems(feed.bulletins);
                    setServiceItems(feed.services);
                    console.log(`[Bulletins Page] Loaded ${feed.services.length} services for current week, ${feed.bulletins.length} published bulletins (all dates, not week-filtered)`);
                }
            } catch (error) {
                console.error('[Bulletins Page] Failed to load combined feed', error);
                if (isMounted) {
                    setBulletinItems([]);
                    setServiceItems([]);
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
    }, [authLoading, user?.uid, filters]);

    const availableMinistries = useMemo(() => {
        const ministrySet = new Set<string>();
        bulletinItems.forEach((bulletin) => {
            bulletin.ministries?.forEach((min) => ministrySet.add(min));
        });
        return Array.from(ministrySet).sort((a, b) => a.localeCompare(b));
    }, [bulletinItems]);

    // No client-side filtering needed - filtering is done server-side
    const filteredBulletins = bulletinItems;

    const applyFilters = useCallback((next: BulletinFilters) => {
        setFilters({ ...next });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({ ...DEFAULT_BULLETIN_FILTERS });
    }, []);

    const activeFilterLabels = useMemo(() => {
        const labels: string[] = [];
        if (filters.ministry !== 'all') {
            labels.push(`Ministry: ${filters.ministry}`);
        }
        if (filters.headline.trim()) {
            labels.push(`Headline: "${filters.headline.trim()}"`);
        }

        return labels;
    }, [filters]);

    if (loading) return <p>Loading...</p>;

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Weekly Bulletin</h1>
                    {activeFilterLabels.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {activeFilterLabels.map((label, index) => (
                                <span
                                    key={`${label}-${index}`}
                                    className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <BulletinsFilterDialog
                    filters={filters}
                    availableMinistries={availableMinistries}
                    onApply={applyFilters}
                    onReset={resetFilters}
                />
            </div>

            {/* Services Section */}
            {serviceItems.length > 0 && (
                <div className="mb-8">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold">
                            {serviceItems.length > 0 ? `For the week of ${format(serviceItems[0].display_week, 'MMM d, yyyy')}` : 'Services'}
                        </h2>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6">
                        {serviceItems.map((service) => (
                            <div
                                key={service.id}
                                className="flex w-full sm:w-[320px] md:w-[360px] lg:w-[380px]"
                            >
                                <ServiceCard
                                    service={service}
                                    onClick={() => {
                                        console.log(`[Service Click] User clicked service "${service.title}" (ID: ${service.id}) at ${new Date().toISOString()}`);
                                        setSelectedService(service);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bulletins Section */}
            <div>
                {serviceItems.length > 0 && (
                    <div className="mb-4 flex items-center gap-2">
                        <span
                            className="text-2xl text-black/60"
                            style={{ fontVariantEmoji: 'text', fontFamily: '"Segoe UI Symbol","Noto Sans Symbols","Noto Sans",sans-serif' }}
                            role="img"
                            aria-hidden="true"
                        >
                            {'\u{1F4E2}\uFE0E'}
                        </span>
                        <h2 className="text-xl font-bold">Announcments</h2>
                    </div>
                )}
                <BulletinList items={filteredBulletins} onItemClick={setSelectedBulletin} />
            </div>

            <BulletinDetailsModal
                bulletin={selectedBulletin}
                isOpen={Boolean(selectedBulletin)}
                onClose={() => setSelectedBulletin(null)}
            />

            {/* Service Detail Modal */}
            {selectedService && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    onClick={() => {
                        console.log(`[Service View] User closed service "${selectedService.title}" modal at ${new Date().toISOString()}`);
                        setSelectedService(null);
                    }}
                >
                    <div
                        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log(`[Service View] User viewing service "${selectedService.title}" details at ${new Date().toISOString()}`);
                        }}
                    >
                        <button
                            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                            onClick={() => setSelectedService(null)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">{selectedService.title}</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-gray-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span className="font-medium">
                                    {(() => {
                                        const [hours, minutes] = selectedService.time_of_day.split(':').map(Number);
                                        const period = hours >= 12 ? 'PM' : 'AM';
                                        const displayHours = hours % 12 || 12;
                                        return `${selectedService.day_of_week} at ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
                                    })()}
                                </span>
                            </div>

                            {selectedService.description && (
                                <div className="text-gray-700">
                                    <p>{selectedService.description}</p>
                                </div>
                            )}

                            {selectedService.timeline_notes && selectedService.timeline_notes.trim() !== '' && (
                                <div className="mt-6 p-4 bg-gray-50 border-l-4 border-blue-900 rounded-r">
                                    <div className="prose prose-sm max-w-none text-gray-700 space-y-0">
                                        {selectedService.timeline_notes.split('\n').map((line, index, array) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return <div key={index} className="h-2" />;
                                            
                                            return (
                                                <div key={index}>
                                                    <div className="py-2 leading-relaxed">
                                                        {trimmedLine}
                                                    </div>
                                                    {index < array.length - 1 && array[index + 1].trim() && (
                                                        <div className="border-b border-gray-200/50 my-1" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default BulletinsPage;
