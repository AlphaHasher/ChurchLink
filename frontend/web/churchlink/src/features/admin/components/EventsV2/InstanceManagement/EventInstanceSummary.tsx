import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { AdminEventInstance } from "@/shared/types/Event";
import { AlertCircle } from "lucide-react";

export function currency(n: number | null | undefined): string {
    if (n === null || n === undefined) return "$0.00";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export function EventInstanceSummary(props: {
    instance: AdminEventInstance;
    totals: {
        totalRegistrations: number;
        totalPaid: number;
        totalDueAtDoor: number;
    };
}) {
    const { instance, totals } = props;

    // Capacity text: show "X / Unlimited" when max_spots is null/undefined
    const capacity = instance.max_spots;
    const seatsText =
        capacity === null || capacity === undefined
            ? `${totals.totalRegistrations} / Unlimited`
            : `${totals.totalRegistrations} / ${capacity}`;

    const registrationOpenBadge = instance.registration_allowed ? (
        <Badge className="whitespace-nowrap">Registration Open</Badge>
    ) : (
        <Badge variant="secondary" className="whitespace-nowrap">Registration Closed</Badge>
    );

    // SPECIAL ALERT MESSAGES BELOW:
    // ---------- Alerts ----------
    const alerts: string[] = [];

    // Registration not required
    if (instance.rsvp_required === false) {
        alerts.push(
            "This event does not require registration, so users will not be able to register, and no payments are expected. If an event was changed from requiring registration to not requiring registration, we still show the full summary below in case any registrations existed prior to the change."
        );
    }

    // Free event ($0 price)
    else if ((instance.price ?? 0) === 0) {
        alerts.push(
            "This event is free and does not require any payment from the user. No PayPal or at-door payments are expected. If any payment values appear, it may be because the price was changed after someone registered or due to historical data."
        );
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

            {/* Alerts block (optional) */}
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                { /* Card that displays how many seats are taken and the capacity */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Seats (Used / Capacity)</div>
                    <div className="text-xl font-semibold">{seatsText}</div>
                </div>

                { /* Card that displays how many users have registrations */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Users with Registrations</div>
                    <div className="text-xl font-semibold">{Object.keys(instance.registration_details || {}).length}</div>
                </div>

                { /* Card that displays cash value of processed payments */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Payments Made Through PayPal</div>
                    <div className="text-xl font-semibold">{currency(totals.totalPaid)}</div>
                </div>

                { /* Card that displays cash value of due payments at the door */}
                <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Payments Due at the Door</div>
                    <div className="text-xl font-semibold">{currency(totals.totalDueAtDoor)}</div>
                </div>
            </div>
        </Card>
    );
}
