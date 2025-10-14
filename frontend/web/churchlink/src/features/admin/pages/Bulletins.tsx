import { useEffect, useState } from 'react';
import { fetchBulletins, fetchServices, reorderServices } from '@/features/bulletins/api/bulletinsApi';
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

    const loadBulletins = async () => {
        try {
            const [publishedBulletins, draftBulletins] = await Promise.all([
                fetchBulletins({ published: true, skip_expiration_filter: true }),
                fetchBulletins({ published: false, skip_expiration_filter: true }),
            ]);

            const merged = new Map<string, ChurchBulletin>();
            [...publishedBulletins, ...draftBulletins].forEach((entry) => {
                merged.set(entry.id, entry);
            });

            const sorted = Array.from(merged.values()).sort((a, b) => {
                const aTime = a.publish_date ? new Date(a.publish_date).getTime() : 0;
                const bTime = b.publish_date ? new Date(b.publish_date).getTime() : 0;
                
                if (aTime !== bTime) {
                    return bTime - aTime;
                }
                
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
            });

            setBulletins(sorted);
        } catch (err) {
            console.error('Failed to load bulletins:', err);
            setBulletins([]);
        }
    };

    const loadServices = async () => {
        try {
            const allServices = await fetchServices({ published: undefined });
            const sorted = allServices.sort((a, b) => {
                // Sort by display_week desc, then order asc
                const aWeek = a.display_week ? new Date(a.display_week).getTime() : 0;
                const bWeek = b.display_week ? new Date(b.display_week).getTime() : 0;
                
                if (aWeek !== bWeek) {
                    return bWeek - aWeek;
                }
                
                return a.order - b.order;
            });
            setServices(sorted);
        } catch (err) {
            console.error('Failed to load services:', err);
            setServices([]);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const permsFromAPI = await fetchPermissions();
            setPerms(permsFromAPI && permsFromAPI.length > 0 ? permsFromAPI[0] : null);
            
            await Promise.all([
                loadBulletins(),
                loadServices(),
            ]);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReorder = async (serviceIds: string[]) => {
        await reorderServices(serviceIds);
        await loadServices();
    };

    useEffect(() => { 
        loadData(); 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <p>Loading Weekly Bulletin...</p>;

    return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Weekly Bulletin Management</h1>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="bulletins">Bulletins</TabsTrigger>
                </TabsList>
                
                <TabsContent value="bulletins" className="mt-6">
                    <BulletinsTable 
                        bulletins={bulletins} 
                        permissions={perms} 
                        onRefresh={loadBulletins} 
                    />
                </TabsContent>
                
                <TabsContent value="services" className="mt-6">
                    <ServicesTable 
                        services={services} 
                        permissions={perms} 
                        onRefresh={loadServices}
                        onReorder={handleReorder}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default Bulletins;
