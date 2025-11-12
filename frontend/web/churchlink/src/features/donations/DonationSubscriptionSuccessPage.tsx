import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";

/**
 * DonationSubscriptionSuccessPage
 *
 * This page is the return/redirect target after the donor approves a PayPal Subscription.
 * Subscriptions don't require a "capture" step like Orders — after approval, PayPal
 * activates the subscription (or moves it to an approvable state) and sends webhooks.
 *
 * We read the query parameters provided by PayPal:
 *   - token
 *   - ba_token (billing agreement token)
 *   - subscription_id
 *
 * Since our current backend exposes creation only (and relies on webhooks for lifecycle),
 * this page:
 *   - Presents a clear success state (or a warning if the subscription_id is missing)
 *   - Stores subscription_id locally to allow an account page to reconcile later
 *   - Provides CTA buttons to continue on the site
 *
 * If/when you add a read/lookup endpoint (e.g., GET /donations/subscription/:id),
 * you can poll it here to display live status.
 */

type PageState =
    | { phase: "loading" }
    | { phase: "success"; subscriptionId: string; token?: string | null; baToken?: string | null }
    | { phase: "warning"; message: string; token?: string | null; baToken?: string | null }
    | { phase: "error"; message: string };

const DonationSubscriptionSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const subscriptionId = useMemo(() => params.get("subscription_id") || "", [params]);
    const token = useMemo(() => params.get("token"), [params]);
    const baToken = useMemo(() => params.get("ba_token"), [params]);

    const [state, setState] = useState<PageState>({ phase: "loading" });

    useEffect(() => {
        // Minimal client-side bookkeeping
        try {
            if (subscriptionId) {
                // Save it so account/donations area can show latest status later
                const key = `donations:last_subscription_id`;
                localStorage.setItem(key, subscriptionId);
            }
        } catch {
            // ignore storage errors
        }

        if (!subscriptionId) {
            // Not ideal, but we can still thank the user and ask them to verify in email/account
            setState({
                phase: "warning",
                message:
                    "We returned from PayPal but didn't receive a subscription id. If your approval succeeded, you'll get a confirmation email shortly.",
                token,
                baToken,
            });
            return;
        }

        setState({ phase: "success", subscriptionId, token, baToken });
    }, [subscriptionId, token, baToken]);

    const goHome = () => navigate("/");
    const goDonations = () => navigate("/donations");

    if (state.phase === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Finalizing Subscription</h2>
                            <p className="text-gray-600">One moment while we wrap things up…</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (state.phase === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-lg w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Something went wrong</h2>
                            <Alert variant="destructive" className="mb-6 text-left">
                                <AlertDescription>{state.message}</AlertDescription>
                            </Alert>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button onClick={goDonations} variant="outline" className="w-full sm:w-auto">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Donations
                                </Button>
                                <Button onClick={goHome} variant="outline" className="w-full sm:w-auto">
                                    Home
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const InfoGrid = ({
        subId,
        tk,
        batk,
    }: {
        subId?: string | null;
        tk?: string | null;
        batk?: string | null;
    }) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="subId">Subscription ID</Label>
                <Input id="subId" readOnly value={subId || "—"} />
            </div>
            <div>
                <Label htmlFor="token">Token</Label>
                <Input id="token" readOnly value={tk || "—"} />
            </div>
            <div>
                <Label htmlFor="batoken">Billing Agreement Token</Label>
                <Input id="batoken" readOnly value={batk || "—"} />
            </div>
        </div>
    );

    if (state.phase === "warning") {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-3xl mx-auto px-4">
                    <Card className="border-yellow-200">
                        <CardHeader>
                            <CardTitle className="text-yellow-700">Approval Received</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Alert className="border-yellow-300 text-yellow-800 bg-yellow-50">
                                <AlertDescription>
                                    We couldn't detect a subscription id in the callback. If the approval succeeded,
                                    PayPal will email you a confirmation and your account will reflect the new
                                    subscription shortly.
                                </AlertDescription>
                            </Alert>

                            <InfoGrid subId={null} tk={state.token} batk={state.baToken} />

                            <Separator />

                            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                                <div className="flex gap-2">
                                    <Button onClick={goDonations}>Give Again</Button>
                                    <Button onClick={goHome} variant="outline">
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Home
                                    </Button>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        window.open(
                                            "https://www.paypal.com/myaccount/autopay/connect/",
                                            "_blank"
                                        )
                                    }
                                >
                                    Manage in PayPal
                                    <ExternalLink className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // success
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4">
                <Card className="border-green-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="h-6 w-6" />
                            Subscription Approved
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                PayPal
                            </Badge>
                            <Badge variant="secondary">Recurring Donation</Badge>
                        </div>

                        <InfoGrid subId={state.subscriptionId} tk={state.token} batk={state.baToken} />

                        <Separator />

                        <div className="text-sm text-muted-foreground">
                            Your subscription may take a moment to appear in your donor history. You’ll receive a
                            receipt from PayPal for each successful charge. If you need to change or cancel, you
                            can manage it in PayPal or through your account once it syncs.
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                            <div className="flex gap-2">
                                <Button onClick={goDonations}>Give Again</Button>
                                <Button onClick={goHome} variant="outline">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Home
                                </Button>
                            </div>

                            <Button
                                variant="secondary"
                                onClick={() =>
                                    window.open(
                                        `https://www.paypal.com/myaccount/autopay/connect/`,
                                        "_blank"
                                    )
                                }
                            >
                                Manage in PayPal
                                <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DonationSubscriptionSuccessPage;
