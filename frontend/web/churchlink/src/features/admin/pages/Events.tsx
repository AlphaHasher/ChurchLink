
// import { useAuth } from "@/lib/auth-context";\
import { useEffect, useState } from "react";
import { fetchEvents } from "@/helpers/EventsHelper";
import { fetchPermissions } from "@/helpers/PermissionsHelper";
import { ChurchEvent } from "@/shared/types/ChurchEvent";
import { AccountPermissions } from "@/shared/types/AccountPermissions";
import EventsTable from "@/features/admin/components/Events/EventsTable";




const Events = () => {
    const [events, setEvents] = useState<ChurchEvent[]>([]);
    const [perms, setPerms] = useState<AccountPermissions[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        const eventsFromAPI = await fetchEvents();
        setEvents(eventsFromAPI);
        const permsFromAPI = await fetchPermissions();
        setPerms(permsFromAPI);
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);



    if (loading) return <p>Loading Events...</p>;

    return (
        <div>
            <h1 className="text-xl font-bold mb-4">Events Management</h1>
            <EventsTable data={events} permData={perms} onSave={loadData}></EventsTable>
        </div>
    );
};

export default Events;