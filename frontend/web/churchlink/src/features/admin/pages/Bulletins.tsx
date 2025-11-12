import { useEffect, useState, useCallback } from 'react';
import { fetchBulletins, fetchServices, reorderServices, reorderBulletins } from '@/features/bulletins/api/bulletinsApi';
import { fetchPermissions } from '@/helpers/PermissionsHelper';
import { ChurchBulletin, ServiceBulletin } from '@/shared/types/ChurchBulletin';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import BulletinsTable from '@/features/admin/components/Bulletins/BulletinsTable';
import ServicesTable from '@/features/admin/components/Bulletins/ServicesTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const Bulletins = () => {
    const [bulletins, setBulletins] = useState<ChurchBulletin[]>([]);
    const [services, setServices] = useState<ServiceBulletin[]>([]);
    const [perms, setPerms] = useState<AccountPermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('services');

    const loadBulletins = useCallback(async (): Promise<ChurchBulletin[]> => {
        try {
            const [publishedBulletins, draftBulletins] = await Promise.all([
                fetchBulletins({ published: true, skip_expiration_filter: true }),
                fetchBulletins({ published: false, skip_expiration_filter: true }),
            ]);

            const merged = new Map<string, ChurchBulletin>();
            [...publishedBulletins, ...draftBulletins].forEach((entry) => {
                merged.set(entry.id, entry);
            });

            const sorted = Array.from(merged.values()).sort((a, b) => a.order - b.order);
            setBulletins(sorted);
            return sorted;
        } catch (err) {
            console.error('Failed to load bulletins:', err);
            setBulletins([]);
            return [];
        }
    }, []);

    const loadServices = useCallback(async (): Promise<ServiceBulletin[]> => {
        try {
            const allServices = await fetchServices({ published: undefined });
            const sorted = allServices.sort((a, b) => {
                const aWeek = a.display_week ? new Date(a.display_week).getTime() : 0;
                const bWeek = b.display_week ? new Date(b.display_week).getTime() : 0;
                
                if (aWeek !== bWeek) {
                    return bWeek - aWeek;
                }
                
                return a.order - b.order;
            });
            setServices(sorted);
            return sorted;
        } catch (err) {
            console.error('Failed to load services:', err);
            setServices([]);
            return [];
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [permsFromAPI] = await Promise.all([
                fetchPermissions(),
                loadBulletins(),
                loadServices(),
            ]);

            setPerms(permsFromAPI && permsFromAPI.length > 0 ? permsFromAPI[0] : null);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, [loadBulletins, loadServices]);

    const handleReorderServices = useCallback(async (serviceIds: string[]) => {
        await reorderServices(serviceIds);
        await loadServices();
    }, [loadServices]);

    const handleReorderBulletins = useCallback(async (bulletinIds: string[]) => {
        await reorderBulletins(bulletinIds);
        await loadBulletins();
    }, [loadBulletins]);

    const handleRefreshBulletins = useCallback(async (): Promise<void> => {
        await loadBulletins();
    }, [loadBulletins]);

    const handleRefreshServices = useCallback(async (): Promise<void> => {
        await loadServices();
    }, [loadServices]);

    useEffect(() => {
        loadData(); 
    }, [loadData]);

    if (loading) return <p>Loading Weekly Bulletin...</p>;

    return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Weekly Bulletin Management</h1>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="gap-3 bg-muted/80 p-2 dark:bg-muted/40">
                    <TabsTrigger
                        value="services"
                        className="px-6 py-2.5 transition-colors hover:text-blue-700 dark:hover:text-blue-200 data-[state=active]:border-blue-500/60 data-[state=active]:text-blue-700 dark:data-[state=active]:border-blue-300/50 dark:data-[state=active]:text-blue-200"
                    >
                        Services
                    </TabsTrigger>
                    <TabsTrigger
                        value="bulletins"
                        className="px-6 py-2.5 transition-colors hover:text-blue-700 dark:hover:text-blue-200 data-[state=active]:border-blue-500/60 data-[state=active]:text-blue-700 dark:data-[state=active]:border-blue-300/50 dark:data-[state=active]:text-blue-200"
                    >
                        Bulletins
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="bulletins" className="mt-6">
                    <BulletinsTable 
                        bulletins={bulletins} 
                        permissions={perms} 
                        onRefresh={handleRefreshBulletins}
                        onReorder={handleReorderBulletins}
                    />
                </TabsContent>
                <TabsContent value="services" className="mt-6">
                    <ServicesTable 
                        services={services} 
                        permissions={perms} 
                        onRefresh={handleRefreshServices}
                        onReorder={handleReorderServices}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default Bulletins;
