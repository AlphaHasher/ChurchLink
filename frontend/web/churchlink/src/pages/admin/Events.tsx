
// import { useAuth } from "@/lib/auth-context";\
import { useEffect, useState } from "react";
import { fetchEvents } from "@/helpers/EventsHelper";
import { ChurchEvent } from "@/types/ChurchEvent";
import EventsTable from "@/components/AdminDashboard/Events/EventsTable";
import { AccountPermissions } from "@/types/AccountPermissions";
import { fetchPermissions } from "@/helpers/PermissionsHelper";




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
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Events Management</h1>
            <EventsTable data={events} permData={perms} onSave={loadData}></EventsTable>
        </div>
    );
};

export default Events;