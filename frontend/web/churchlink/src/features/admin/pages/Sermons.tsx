import { useEffect, useState } from 'react';
import { fetchSermons } from '@/features/sermons/api/sermonsApi';
import { fetchPermissions } from '@/helpers/PermissionsHelper';
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import SermonsTable from '@/features/admin/components/Sermons/SermonsTable';

const Sermons = () => {
    const [sermons, setSermons] = useState<ChurchSermon[]>([]);
    const [perms, setPerms] = useState<AccountPermissions[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [publishedSermons, draftSermons, permsFromAPI] = await Promise.all([
                fetchSermons({ published: true }),
                fetchSermons({ published: false }),
                fetchPermissions()
            ]);

            const merged = new Map<string, ChurchSermon>();
            [...publishedSermons, ...draftSermons].forEach((entry) => {
                merged.set(entry.id, entry);
            });

            const sorted = Array.from(merged.values()).sort((a, b) => {
                const aTime = a.date_posted ? new Date(a.date_posted).getTime() : 0;
                const bTime = b.date_posted ? new Date(b.date_posted).getTime() : 0;
                return bTime - aTime;
            });

            setSermons(sorted);
            setPerms(permsFromAPI);
        } catch (err) {
            console.error('Failed to load sermons management data:', err);
            setSermons([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadData(); }, []);

    if (loading) return <p>Loading Sermons...</p>;

    return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Sermons Management</h1>
            <SermonsTable data={sermons} permData={perms} onSave={loadData}></SermonsTable>
        </div>
    )
}

export default Sermons;
