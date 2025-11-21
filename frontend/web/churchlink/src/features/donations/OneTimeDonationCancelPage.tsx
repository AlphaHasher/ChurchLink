import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useLocalize } from "@/shared/utils/localizationUtils";

/**
 * One-time Donation PayPal cancel page.
 *
 * This is the target for the cancel_url of the one-time donation PayPal flow:
 *   /donations/one-time/cancel?token=<ORDER_ID>&PayerID=<...>
 *
 * It mirrors the visual language of:
 *  - OneTimeDonationSuccess (green success) for donations
 *  - PaymentCancelPageV2 (red cancel summary) for events
 */

const OnetimeDonationCancelPage: React.FC = () => {
    const localize = useLocalize();

    const navigate = useNavigate();
    const [params] = useSearchParams();

    // PayPal sends token=<ORDER_ID> on cancel_url; sometimes order_id is used instead
    const orderId = useMemo(
        () => params.get("token") || params.get("order_id") || "",
        [params]
    );
    const payerId = useMemo(() => params.get("PayerID") || "", [params]);

    const goMyTransactions = () => navigate("/my-transactions");
    const goHome = () => navigate("/");

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4">
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-6 w-6" />
                            {localize("Donation Cancelled")}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertDescription className="text-sm text-amber-900">
                                {localize("No payment was captured and your donation was not completed.")}
                                {localize("Your card or PayPal account has not been charged.")}
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="orderRef" className="text-xs uppercase text-gray-500">
                                    {localize("Order Reference")}
                                </Label>
                                <Input
                                    id="orderRef"
                                    readOnly
                                    value={orderId || "—"}
                                    className="mt-1 font-mono"
                                />
                            </div>
                            <div>
                                <Label htmlFor="payerId" className="text-xs uppercase text-gray-500">
                                    {localize("Payer ID")}
                                </Label>
                                <Input
                                    id="payerId"
                                    readOnly
                                    value={payerId || "—"}
                                    className="mt-1 font-mono"
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2 text-sm text-gray-700">
                            <div>{localize("What happened?")}</div>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{localize("You left or canceled during PayPal checkout.")}</li>
                                <li>{localize("No money was charged for this donation.")}</li>
                                <li>
                                    {localize("If you still want to give, you can start a new donation from the donations page.")}
                                </li>
                            </ul>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button onClick={goMyTransactions} className="flex items-center">
                                <CreditCard className="h-4 w-4 mr-2" />
                                {localize("Go to My Transactions")}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={goHome}
                                className="flex items-center"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                {localize("Home")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OnetimeDonationCancelPage;
