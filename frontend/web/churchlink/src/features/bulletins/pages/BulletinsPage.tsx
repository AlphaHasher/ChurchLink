import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCombinedFeed, fetchCurrentWeek, ServerWeekInfo } from '@/features/bulletins/api/bulletinsApi';
import BulletinList from '@/features/bulletins/components/BulletinList';
import { ServiceCard } from '@/features/bulletins/components/ServiceCard';
import { BulletinDetailsModal } from '@/features/bulletins/components/BulletinDetailsModal';
import { BulletinsFilterDialog, DEFAULT_BULLETIN_FILTERS, BulletinFilters } from '@/features/bulletins/components/BulletinsFilterDialog';
import { ServicesFilterDialog, ServiceFilters } from '@/features/bulletins/components/ServicesFilterDialog';
import { ChurchBulletin, ServiceBulletin, BulletinFilter, DEFAULT_BULLETIN_LIMIT } from '@/shared/types/ChurchBulletin';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { fetchMinistries } from '@/helpers/MinistriesHelper';
import type { Ministry } from '@/shared/types/Ministry';

const BulletinsPage = () => {
    const [bulletinItems, setBulletinItems] = useState<ChurchBulletin[]>([]);
    const [serviceItems, setServiceItems] = useState<ServiceBulletin[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBulletin, setSelectedBulletin] = useState<ChurchBulletin | null>(null);
    const [selectedService, setSelectedService] = useState<ServiceBulletin | null>(null);
    const [announcementFilters, setAnnouncementFilters] = useState<BulletinFilters>({ ...DEFAULT_BULLETIN_FILTERS });
    const [serviceFilters, setServiceFilters] = useState<ServiceFilters>({ dayOfWeek: 'all', timeRange: 'all', title: '' });
    const [serverWeek, setServerWeek] = useState<ServerWeekInfo | null>(null);
    const { user, loading: authLoading } = useAuth();
    const [allMinistries, setAllMinistries] = useState<Ministry[]>([]);

    // Load ministries on mount
    useEffect(() => {
        (async () => {
            try {
                const res = await fetchMinistries();
                setAllMinistries(res ?? []);
            } catch (e) {
                console.error('[Bulletins Page] Failed to load ministries', e);
            }
        })();
    }, []);

    const ministryNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const m of allMinistries) {
            map[m.id] = m.name;
        }
        return map;
    }, [allMinistries]);

    // Load data whenever announcement filters change
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            try {
                console.log(`[Bulletins Page] Loading feed with filters at ${new Date().toISOString()}`, announcementFilters);

                // Fetch server-localized week info
                const weekInfo = await fetchCurrentWeek();
                if (isMounted) {
                    setServerWeek(weekInfo);
                    console.log(`[Bulletins Page] Server week: ${weekInfo.week_label} (${weekInfo.timezone})`);
                }

                const weekStart = new Date(weekInfo.week_start);
                const weekEnd = new Date(weekInfo.week_end);

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

                if (announcementFilters.ministry && announcementFilters.ministry !== 'all') {
                    apiFilters.ministry_id = announcementFilters.ministry;
                }

                if (announcementFilters.headline.trim()) {
                    apiFilters.query = announcementFilters.headline.trim();
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
    }, [authLoading, user?.uid, announcementFilters]);

    const availableMinistries = useMemo(() => {
        return allMinistries.map((m) => ({ id: m.id, name: m.name }));
    }, [allMinistries]);

    // Client-side filtering for services
    const filteredServices = useMemo(() => {
        let filtered = serviceItems;

        // Filter by day of week
        if (serviceFilters.dayOfWeek !== 'all') {
            filtered = filtered.filter((service) => service.day_of_week === serviceFilters.dayOfWeek);
        }

        // Filter by time range
        if (serviceFilters.timeRange !== 'all') {
            filtered = filtered.filter((service) => {
                const [hours] = service.time_of_day.split(':').map(Number);
                switch (serviceFilters.timeRange) {
                    case 'morning':
                        return hours >= 6 && hours < 12;
                    case 'afternoon':
                        return hours >= 12 && hours < 18;
                    case 'evening':
                        return hours >= 18 || hours < 6;
                    default:
                        return true;
                }
            });
        }

        // Filter by title search
        if (serviceFilters.title.trim()) {
            const query = serviceFilters.title.toLowerCase();
            filtered = filtered.filter((service) => service.title.toLowerCase().includes(query));
        }

        return filtered;
    }, [serviceItems, serviceFilters]);

    // No client-side filtering needed for bulletins - filtering is done server-side
    const filteredBulletins = bulletinItems;

    const applyAnnouncementFilters = useCallback((next: BulletinFilters) => {
        setAnnouncementFilters({ ...next });
    }, []);

    const resetAnnouncementFilters = useCallback(() => {
        setAnnouncementFilters({ ...DEFAULT_BULLETIN_FILTERS });
    }, []);

    const applyServiceFilters = useCallback((next: ServiceFilters) => {
        setServiceFilters({ ...next });
    }, []);

    const resetServiceFilters = useCallback(() => {
        setServiceFilters({ dayOfWeek: 'all', timeRange: 'all', title: '' });
    }, []);

    const activeAnnouncementFilterLabels = useMemo(() => {
        const labels: string[] = [];
        if (announcementFilters.ministry && announcementFilters.ministry !== 'all') {
            const ministryName = ministryNameMap[announcementFilters.ministry] || announcementFilters.ministry;
            labels.push(`Ministry: ${ministryName}`);
        }
        if (announcementFilters.headline.trim()) {
            labels.push(`Title: "${announcementFilters.headline.trim()}"`);
        }

        return labels;
    }, [announcementFilters, ministryNameMap]);

    const activeServiceFilterLabels = useMemo(() => {
        const labels: string[] = [];
        if (serviceFilters.dayOfWeek !== 'all') {
            labels.push(`Day: ${serviceFilters.dayOfWeek}`);
        }
        if (serviceFilters.timeRange !== 'all') {
            const timeRangeLabel = serviceFilters.timeRange.charAt(0).toUpperCase() + serviceFilters.timeRange.slice(1);
            labels.push(`Time: ${timeRangeLabel}`);
        }
        if (serviceFilters.title.trim()) {
            labels.push(`Title: "${serviceFilters.title.trim()}"`);
        }

        return labels;
    }, [serviceFilters]);

    if (loading) return <p>Loading...</p>;

    return (
        <div className="flex justify-center bg-gray-50 py-8">
            <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Weekly Bulletin</h1>
                </div>

                {/* Services Section - Always show header and filter */}
                <div className="mb-12">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">
                                {serverWeek ? serverWeek.week_label : 'Services'}
                            </h2>
                            {activeServiceFilterLabels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {activeServiceFilterLabels.map((label, index) => (
                                        <span
                                            key={`service-filter-${index}`}
                                            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <ServicesFilterDialog
                            filters={serviceFilters}
                            onApply={applyServiceFilters}
                            onReset={resetServiceFilters}
                        />
                    </div>
                    {filteredServices.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-6">
                            {filteredServices.map((service) => (
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
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-gray-600 font-medium mb-1">No services found</p>
                            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                {/* Bulletins Section - Always show header and filter */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Announcements</h2>
                            {activeAnnouncementFilterLabels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {activeAnnouncementFilterLabels.map((label, index) => (
                                        <span
                                            key={`announcement-filter-${index}`}
                                            className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <BulletinsFilterDialog
                            filters={announcementFilters}
                            availableMinistries={availableMinistries}
                            onApply={applyAnnouncementFilters}
                            onReset={resetAnnouncementFilters}
                        />
                    </div>
                    {filteredBulletins.length > 0 ? (
                        <BulletinList items={filteredBulletins} onItemClick={setSelectedBulletin} ministryNameMap={ministryNameMap} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-gray-600 font-medium mb-1">No announcements found</p>
                            <p className="text-gray-500 text-sm">Try adjusting your filters</p>
                        </div>
                    )}
                </div>

                <BulletinDetailsModal
                    bulletin={selectedBulletin}
                    isOpen={Boolean(selectedBulletin)}
                    onClose={() => setSelectedBulletin(null)}
                    ministryNameMap={ministryNameMap}
                />

                {/* Service Detail Modal */}
                {selectedService && (
                    <div
                        className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50"
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
        </div>
    );
}

export default BulletinsPage;
