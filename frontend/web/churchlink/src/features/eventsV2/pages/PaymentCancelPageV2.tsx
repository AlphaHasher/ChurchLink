import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    XCircle,
    ArrowLeft,
    Users,
    Calendar,
    MapPin,
    Church,
    DollarSign,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";

import { useFetchEventInstanceDetails } from "@/helpers/EventUserHelper";
import { fmtDateTime } from "@/helpers/RegistrationPaymentModalLogic";
import { getPublicUrl } from "@/helpers/MediaInteraction";

import type { EventDetailsResponse, UserFacingEvent } from "@/shared/types/Event";

const PaymentCancelPageV2: React.FC = () => {
    const navigate = useNavigate();
    const { instanceId } = useParams<{ instanceId: string }>();
    const [params] = useSearchParams();

    // PayPal returns ?token=<order_id> on cancel_url
    const orderId = params.get("token") || params.get("order_id") || "";

    const { fetchEventInstanceDetails } = useFetchEventInstanceDetails();
    const [resp, setResp] = useState<EventDetailsResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!instanceId) {
                setLoading(false);
                return;
            }
            try {
                const data = await fetchEventInstanceDetails(instanceId);
                if (mounted) setResp(data);
            } catch (err) {
                console.error("[PaymentCancelPageV2] fetchEventInstanceDetails error:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [instanceId, fetchEventInstanceDetails]);

    const eventDetails: UserFacingEvent | null = useMemo(
        () => resp?.event_details ?? null,
        [resp]
    );
    const heroUrl = eventDetails?.image_id ? getPublicUrl(eventDetails.image_id) : null;

    const backToEvent = () =>
        navigate(
            eventDetails?.id ? `/sharable_events/${encodeURIComponent(eventDetails.id)}` : "/events"
        );
    const toMyEvents = () => navigate("/profile/my-events");

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Loading event</h2>
                            <p className="text-gray-600">Please wait…</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4 grid gap-6 lg:grid-cols-2">
                {/* LEFT: Cancellation summary (mirrors Success page structure) */}
                <div className="space-y-6">
                    <Card className="border-red-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-700">
                                <XCircle className="h-6 w-6" />
                                Payment Cancelled
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert className="border-amber-200 bg-amber-50">
                                <AlertDescription className="text-sm text-amber-900">
                                    No payment was captured and your registration was not completed.
                                    Your spot has <strong>not</strong> been reserved.
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">Order Reference</div>
                                    <div className="text-sm font-mono truncate">{orderId || "—"}</div>
                                </div>
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">Status</div>
                                    <div className="text-sm font-semibold text-red-700">Cancelled</div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2 text-sm text-gray-700">
                                <div>What happened?</div>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>You left or canceled during PayPal checkout.</li>
                                    <li>No money was charged for this order.</li>
                                    <li>If you still want to attend, you can try again below.</li>
                                </ul>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={backToEvent} className="flex items-center">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Event
                                </Button>
                                <Button variant="outline" onClick={toMyEvents} className="flex items-center">
                                    <Users className="h-4 w-4 mr-2" />
                                    View My Events
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: Event details (same visual language as success page) */}
                <div className="space-y-6">
                    {eventDetails && (
                        <Card className="overflow-hidden">
                            {heroUrl ? (
                                <img
                                    src={heroUrl}
                                    alt={eventDetails.default_title || "Event image"}
                                    className="block w-full h-auto object-cover max-h-64"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : (
                                <div className="w-full h-40 bg-muted" />
                            )}

                            <CardHeader className="pb-0">
                                <CardTitle className="flex items-start justify-between gap-4">
                                    <span className="font-semibold">{eventDetails.default_title || "Event"}</span>
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {eventDetails.ministries && eventDetails.ministries.length > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Church className="h-4 w-4" />
                                        <span>{eventDetails.ministries.join(" • ")}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>{fmtDateTime(eventDetails.date)}</span>
                                </div>

                                {eventDetails.default_location_info && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span className="truncate">{eventDetails.location_address}</span>
                                    </div>
                                )}

                                {(eventDetails.price != null || eventDetails.member_price != null) && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <DollarSign className="h-4 w-4" />
                                        <span>
                                            {eventDetails.member_price != null
                                                ? `$${Number(eventDetails.member_price).toFixed(2)} (member) • $${Number(
                                                    eventDetails.price ?? 0
                                                ).toFixed(2)} (standard)`
                                                : `$${Number(eventDetails.price ?? 0).toFixed(2)} per person`}
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentCancelPageV2;
