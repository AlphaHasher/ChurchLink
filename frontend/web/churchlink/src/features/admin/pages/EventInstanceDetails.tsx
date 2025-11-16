import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";

import { AdminEventInstance, RegistrationDetails } from "@/shared/types/Event";
import { fetchAdminPanelInstanceAssemblyById } from "@/helpers/EventManagementHelper";

import { EventInstanceSummary } from "@/features/admin/components/EventsV2/InstanceManagement/EventInstanceSummary";
import { EventInstanceRegistrationsTable, RegistrationsRow } from "@/features/admin/components/EventsV2/InstanceManagement/EventInstanceRegistrationsTable";

type State =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "loaded"; instance: AdminEventInstance };

function computeRows(instance: AdminEventInstance): {
    rows: RegistrationsRow[];
    totals: { totalRegistrations: number; totalPaid: number; totalDueAtDoor: number };
} {
    const details = instance.registration_details || {};
    const rows: RegistrationsRow[] = [];
    let totalPaid = 0;
    let totalDueAtDoor = 0;

    Object.entries(details).forEach(([uid, rd]) => {
        const { headcount, paid, dueAtDoor } = aggregateForUid(rd);
        totalPaid += paid;
        totalDueAtDoor += dueAtDoor;

        rows.push({
            uid,
            registrations: headcount,
            moneyPaid: paid,
            moneyDue: dueAtDoor,
        });
    });

    return {
        rows: rows.sort((a, b) => b.moneyDue - a.moneyDue),
        totals: {
            totalRegistrations: instance.seats_filled ?? 0,
            totalPaid,
            totalDueAtDoor,
        },
    };
}

function aggregateForUid(
    rd: RegistrationDetails,
): { headcount: number; paid: number; dueAtDoor: number } {
    const headcount = (rd.self_registered ? 1 : 0) + (rd.family_registered?.length ?? 0);

    let paid = 0;
    let dueAtDoor = 0;

    if (rd.self_payment_details) {
        const p = rd.self_payment_details;
        if (p.payment_complete) {
            paid += p.price || 0;
        } else if (p.payment_type === "door") {
            dueAtDoor += p.price || 0;
        }
    }

    if (rd.family_payment_details) {
        Object.values(rd.family_payment_details).forEach((p) => {
            if (p.payment_complete) {
                paid += p.price || 0;
            } else if (p.payment_type === "door") {
                dueAtDoor += p.price || 0;
            }
        });
    }

    return { headcount, paid, dueAtDoor };
}

export default function EventInstanceDetails() {
    const { instanceId, eventId } = useParams<{ eventId: string; instanceId: string }>();
    const [state, setState] = useState<State>({ kind: "idle" });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setState({ kind: "loading" });
                const instance = await fetchAdminPanelInstanceAssemblyById(instanceId!);
                if (cancelled) return;
                if (!instance) {
                    setState({ kind: "error", message: "Instance not found or failed to load." });
                } else {
                    setState({ kind: "loaded", instance });
                }
            } catch (e: any) {
                if (cancelled) return;
                setState({ kind: "error", message: e?.message ?? "Failed to load instance." });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [instanceId]);

    const loadedInstance = state.kind === "loaded" ? state.instance : null;
    const memo = useMemo(() => {
        if (!loadedInstance) {
            return {
                rows: [] as RegistrationsRow[],
                totals: { totalRegistrations: 0, totalPaid: 0, totalDueAtDoor: 0 },
            };
        }
        return computeRows(loadedInstance);
    }, [loadedInstance]);

    if (state.kind === "loading" || state.kind === "idle") {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-9 w-36" />
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
            </div>
        );
    }

    if (state.kind === "error") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Badge variant="destructive">Error</Badge>
                    <span className="text-sm text-muted-foreground">{state.message}</span>
                </div>
                <Button asChild variant="secondary">
                    <Link to={`/admin/events/${eventId}`}>Back to Instances</Link>
                </Button>
            </div>
        );
    }

    const instance = state.instance;
    const { rows, totals } = memo;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <Link to={`/admin/events`}>Events</Link>
                    <span className="text-muted-foreground">/</span>
                    <Link to={`/admin/events/${eventId}`}>Instances</Link>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">Instance Details</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild variant="outline">
                        <Link to={`/admin/events/${eventId}`}>Back</Link>
                    </Button>
                </div>
            </div>

            <EventInstanceSummary
                instance={instance}
                totals={{
                    totalRegistrations: totals.totalRegistrations,
                    totalPaid: totals.totalPaid,
                    totalDueAtDoor: totals.totalDueAtDoor,
                }}
            />

            <Separator />

            <EventInstanceRegistrationsTable rows={rows} />

        </div>

    );
}
