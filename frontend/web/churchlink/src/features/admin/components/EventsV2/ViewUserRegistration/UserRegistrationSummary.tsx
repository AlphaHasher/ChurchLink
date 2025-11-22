import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { AlertCircle } from "lucide-react";
import type { AdminEventInstance, RegistrationDetails } from "@/shared/types/Event";

export function currency(n: number | null | undefined): string {
    if (n === null || n === undefined) return "$0.00";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export default function UserRegistrationSummary({
    instance,
    reg,
}: {
    instance: AdminEventInstance;
    reg: RegistrationDetails | null;
}) {
    const capacity = instance.max_spots ?? null;
    const seatsText = capacity ? `${instance.seats_filled} / ${capacity}` : `${instance.seats_filled} / Unlimited`;

    const userRegistrations =
        (reg?.self_registered ? 1 : 0) + (Array.isArray(reg?.family_registered) ? reg!.family_registered.length : 0);

    let paid = 0;
    let dueAtDoor = 0;

    const add = (price?: number | null) => (typeof price === "number" ? price : 0);

    if (reg?.self_payment_details) {
        const p = reg.self_payment_details;
        if (p.payment_complete) paid += add(p.price);
        else if (p.payment_type === "door") dueAtDoor += add(p.price);
    }
    if (reg?.family_payment_details) {
        for (const p of Object.values(reg.family_payment_details)) {
            if (p?.payment_complete) paid += add(p.price);
            else if (p?.payment_type === "door") dueAtDoor += add(p.price);
        }
    }

    const registrationOpenBadge = instance.registration_allowed ? (
        <Badge className="whitespace-nowrap">Registration Open</Badge>
    ) : (
        <Badge variant="secondary" className="whitespace-nowrap">Registration Closed</Badge>
    );

    const alerts: string[] = [];
    if (instance.rsvp_required === false) {
        alerts.push(
            "This event does not require registration. If it was changed after signups, any historical registrations may still show."
        );
    } else if ((instance.price ?? 0) === 0) {
        alerts.push("This event is free; no PayPal or at-door payment is expected unless pricing changed after signups.");
    }

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <div className="text-lg font-semibold">{instance.default_title || "Event Instance"}</div>
                    <div className="text-sm text-muted-foreground">
                        {new Date(instance.date).toLocaleString()} • {instance.location_address ?? "Location TBA"}
                    </div>
                </div>
                <div className="flex items-center gap-2">{registrationOpenBadge}</div>
            </div>

            {alerts.length > 0 && (
                <div className="mb-4 space-y-2">
                    {alerts.map((msg, i) => (
                        <div
                            key={i}
                            role="alert"
                            className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
                        >
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <p>{msg}</p>
                        </div>
                    ))}
                </div>
            )}

            { /* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                { /* Seat used / Capacity */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Seats (Used / Capacity)</div>
                    <div className="text-xl font-semibold">{seatsText}</div>
                </div>

                { /* Registrations for THIS user */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Registrations for User</div>
                    <div className="text-xl font-semibold">{userRegistrations}</div>
                </div>

                { /* Processed Cash from THIS user */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Payments Made Through PayPal</div>
                    <div className="text-xl font-semibold">{currency(paid)}</div>
                </div>

                { /* Cash due at the door from THIS user */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Payments Due at the Door</div>
                    <div className="text-xl font-semibold">{currency(dueAtDoor)}</div>
                </div>
            </div>
        </Card>
    );
}
