import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

import type { AdminEventInstance, RegistrationDetails, PersonDict } from "@/shared/types/Event";
import { fetchRegistrationDetailsByInstanceAndUser } from "@/helpers/EventManagementHelper";
import UserRegistrationSummary from "@/features/admin/components/EventsV2/ViewUserRegistration/UserRegistrationSummary";
import RegisteredPersonsTable from "@/features/admin/components/EventsV2/ViewUserRegistration/RegisteredPersonsTable";
import NonRegisteredPeopleTable from "@/features/admin/components/EventsV2/ViewUserRegistration/NonRegisteredPeopleTable";

type Loaded = {
    instance: AdminEventInstance;
    personDict: PersonDict;
    reg: RegistrationDetails | null;
};

export default function ViewUserRegistrationDetails() {
    const { eventId, instanceId, userId } = useParams<{ eventId: string; instanceId: string; userId: string }>();
    const [state, setState] = useState<"idle" | "loading" | "error" | "loaded">("idle");
    const [err, setErr] = useState<string | null>(null);
    const [data, setData] = useState<Loaded | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setState("loading");
                const res = await fetchRegistrationDetailsByInstanceAndUser(instanceId!, userId!);
                if (cancelled) return;

                if (!res?.success || !res?.event_instance || !res?.person_dict) {
                    setState("error");
                    setErr(res?.msg || "Failed to load registration details.");
                    return;
                }

                const reg = res.event_instance.registration_details?.[userId!] ?? null;
                setData({ instance: res.event_instance, personDict: res.person_dict!, reg });
                setState("loaded");
            } catch (e: any) {
                if (cancelled) return;
                setState("error");
                setErr(e?.message || "Failed to load registration details.");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [instanceId, userId]);

    const eventTitle = data?.instance?.default_title || "Event";

    useEffect(() => {
        const handler = () => {
            // simply rerun the same fetch as initial load
            (async () => {
                try {
                    setState("loading");
                    const res = await fetchRegistrationDetailsByInstanceAndUser(instanceId!, userId!);
                    if (!res?.success || !res?.event_instance || !res?.person_dict) {
                        setState("error");
                        setErr(res?.msg || "Failed to load registration details.");
                        return;
                    }
                    const reg = res.event_instance.registration_details?.[userId!] ?? null;
                    setData({ instance: res.event_instance, personDict: res.person_dict!, reg });
                    setState("loaded");
                } catch (e: any) {
                    setState("error");
                    setErr(e?.message || "Failed to reload registration details.");
                }
            })();
        };

        window.addEventListener("admin:registration:changed", handler);
        return () => window.removeEventListener("admin:registration:changed", handler);
    }, [instanceId, userId]);

    // compute rows for tables
    const tables = useMemo(() => {
        if (!data?.personDict) {
            return {
                registeredIds: [] as string[],
                nonRegisteredIds: [] as string[],
            };
        }

        const registeredIds: string[] = [];
        if (data?.reg?.self_registered) registeredIds.push("SELF");
        for (const fid of (data?.reg?.family_registered ?? [])) registeredIds.push(fid);

        // Build the full roster from person_dict, always includes SELF
        const allIds = ["SELF", ...Object.keys(data.personDict).filter((k) => k !== "SELF")];

        const nonRegisteredIds = allIds.filter((id) => !registeredIds.includes(id));

        return { registeredIds, nonRegisteredIds };
    }, [data?.personDict, data?.reg]);

    if (state === "idle" || state === "loading") {
        return (
            <div className="space-y-6">
                {/* Breadcrumb skeleton */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-64" />
                </div>

                <Card className="p-4">
                    <Skeleton className="h-5 w-48 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </Card>

                <Card className="p-4">
                    <Skeleton className="h-5 w-48 mb-4" />
                    <Skeleton className="h-64 w-full" />
                </Card>

                <Card className="p-4">
                    <Skeleton className="h-5 w-48 mb-4" />
                    <Skeleton className="h-48 w-full" />
                </Card>
            </div>
        );
    }

    if (state === "error") {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Admin / Events / Instance / User Registrations</div>
                </div>
                <Card className="p-6">
                    <div className="text-rose-700">{err}</div>
                </Card>
            </div>
        );
    }

    const instance = data!.instance;
    const personDict = data!.personDict;
    const reg = data!.reg;

    return (
        <div className="space-y-6">
            {/* Breadcrumbs */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                    <Link className="hover:underline" to="/admin/events">
                        All Events
                    </Link>
                    <span>›</span>
                    <Link className="hover:underline" to={`/admin/events/${eventId}`}>
                        Instances for {eventTitle}
                    </Link>
                    <span>›</span>
                    <Link className="hover:underline" to={`/admin/events/${eventId}/instance_details/${instanceId}`}>
                        Instance Registrations
                    </Link>
                    <span>›</span>
                    <span className="text-foreground">User: {userId}</span>
                </div>
                {/* Removed date/location badges; summary is source of truth */}
                <div />
            </div>

            {/* Summary */}
            <UserRegistrationSummary instance={instance} reg={reg} />

            {/* Registered people */}
            <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-base font-semibold">Registered People</div>
                    <div className="text-sm text-muted-foreground">
                        {tables.registeredIds.length} {tables.registeredIds.length === 1 ? "person" : "people"}
                    </div>
                </div>
                <RegisteredPersonsTable instance={instance} reg={reg} personDict={personDict} personIds={tables.registeredIds} userId={userId!} />
            </Card>

            {/* Not Registered */}
            <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-base font-semibold">Not Registered</div>
                    <div className="text-sm text-muted-foreground">
                        {tables.nonRegisteredIds.length} {tables.nonRegisteredIds.length === 1 ? "person" : "people"}
                    </div>
                </div>
                <NonRegisteredPeopleTable instance={instance} personDict={personDict} personIds={tables.nonRegisteredIds} userId={userId!} />
            </Card>
        </div>
    );
}
