import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft, ExternalLink, Repeat2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

/**
 * DonationSubscriptionCancelPage
 *
 * Target for the cancel_url of PayPal Subscriptions:
 *   /donations/subscription/cancel?token=<approval_token>&ba_token=<...>&subscription_id=<maybe>
 *
 * Unlike the success page, we expect subscription_id to usually be missing here,
 * because the user cancelled before finalizing. We still show whatever data we got.
 */

const DonationSubscriptionCancelPage: React.FC = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const subscriptionId = useMemo(
        () => params.get("subscription_id") || "",
        [params]
    );
    const token = useMemo(() => params.get("token") || "", [params]);
    const baToken = useMemo(() => params.get("ba_token") || "", [params]);

    const goHome = () => navigate("/");
    const goDonations = () => navigate("/donations");

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4">
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-6 w-6" />
                            Subscription Setup Cancelled
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertDescription className="text-sm text-amber-900">
                                No recurring donation was created. Your PayPal account will{" "}
                                <strong>not</strong> be charged on a schedule for this attempt.
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label
                                    htmlFor="subscriptionId"
                                    className="text-xs uppercase text-gray-500"
                                >
                                    Subscription ID
                                </Label>
                                <Input
                                    id="subscriptionId"
                                    readOnly
                                    value={subscriptionId || "—"}
                                    className="mt-1 font-mono"
                                />
                            </div>
                            <div>
                                <Label htmlFor="token" className="text-xs uppercase text-gray-500">
                                    Approval Token
                                </Label>
                                <Input
                                    id="token"
                                    readOnly
                                    value={token || "—"}
                                    className="mt-1 font-mono"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="baToken"
                                    className="text-xs uppercase text-gray-500"
                                >
                                    Billing Agreement Token
                                </Label>
                                <Input
                                    id="baToken"
                                    readOnly
                                    value={baToken || "—"}
                                    className="mt-1 font-mono"
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2 text-sm text-gray-700">
                            <div>What happened?</div>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>You left or canceled during the PayPal subscription approval flow.</li>
                                <li>We did not create a recurring donation for this attempt.</li>
                                <li>
                                    If you still want to support monthly/weekly/yearly, you can start a new
                                    recurring donation below.
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-2">
                            <div className="flex gap-2">
                                <Button onClick={goDonations} className="flex items-center">
                                    <Repeat2 className="h-4 w-4 mr-2" />
                                    Back to Donations
                                </Button>
                                <Button
                                    onClick={goHome}
                                    variant="outline"
                                    className="flex items-center"
                                >
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
                                className="flex items-center justify-center"
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

export default DonationSubscriptionCancelPage;
