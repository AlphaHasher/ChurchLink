import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, ArrowLeft, ExternalLink, CircleDollarSign } from "lucide-react";


import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { captureOneTimeDonation } from "@/helpers/DonationHelper";

/**
 * One-time Donation PayPal success page.
 * Reads ?token=<ORDER_ID> from the URL, calls backend capture once (idempotent),
 * and shows a clean receipt summary.
 *
 * Mirrors the router + UI conventions used by the event success page.
 */

type CaptureState =
    | { phase: "loading" }
    | {
        phase: "success";
        order_id: string;
        capture_id?: string | null;
        captured_amount?: number | null;
        currency?: string | null;
        status: "captured" | "already_captured";
    }
    | { phase: "error"; message: string };

const OnetimeDonationSuccess: React.FC = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    // PayPal returns token=<ORDER_ID> (& PayerID=...)
    const orderId = useMemo(() => params.get("token") || params.get("order_id") || "", [params]);
    const payerId = useMemo(() => params.get("PayerID") || "", [params]);

    const [state, setState] = useState<CaptureState>({ phase: "loading" });

    // ---- simple idempotent lock (guards double-capture across mounts/tabs) ----
    const lockKey = orderId ? `donation:paypal:capture:${orderId}` : "";
    const lockOwnerRef = useRef<string | null>(null);
    const isLock = (v: string) => v.startsWith("LOCK:");
    const isDone = (v: string) => v === "1";
    const now = () => Date.now();
    const makeToken = () => `${now()}-${Math.random().toString(36).slice(2)}`;
    const readStore = (k: string) => {
        try {
            return localStorage.getItem(k) || "";
        } catch {
            return "";
        }
    };
    const writeStore = (k: string, v: string) => {
        try {
            localStorage.setItem(k, v);
        } catch { }
    };
    const removeStore = (k: string) => {
        try {
            localStorage.removeItem(k);
        } catch { }
    };
    const tryLock = (k: string) => {
        const v = readStore(k);
        if (isDone(v)) return false;
        if (isLock(v)) return false; // let the owner finish; backend is idempotent anyway
        const token = makeToken();
        writeStore(k, `LOCK:${token}:${now()}`);
        lockOwnerRef.current = token;
        return true;
    };
    const release = (k: string, ok: boolean) => {
        const v = readStore(k);
        if (!isLock(v)) return;
        const token = v.split(":")[1];
        if (token !== lockOwnerRef.current) return;
        if (ok) writeStore(k, "1");
        else removeStore(k);
    };

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!orderId) {
                setState({ phase: "error", message: "Missing PayPal order id in the URL." });
                return;
            }

            // already done?
            if (isDone(readStore(lockKey))) {
                // quick happy path; backend capture already finished on this browser
                setState({
                    phase: "success",
                    order_id: orderId,
                    capture_id: null,
                    captured_amount: null,
                    currency: "USD",
                    status: "already_captured",
                });
                return;
            }

            // acquire transient lock if possible
            const haveLock = tryLock(lockKey);
            if (!haveLock) {
                // Another tab/mount is doing it; optimistic "loading" then success
                setState({ phase: "loading" });
            }

            try {
                const res = await captureOneTimeDonation({ order_id: orderId });

                if (cancelled) return;

                if (!res.success) {
                    release(lockKey, false);
                    setState({
                        phase: "error",
                        message: res.msg || "We couldn't finalize your donation. Please try again.",
                    });
                    return;
                }

                release(lockKey, true);
                setState({
                    phase: "success",
                    order_id: res.order_id || orderId,
                    capture_id: res.capture_id ?? null,
                    captured_amount: typeof res.captured_amount === "number" ? res.captured_amount : null,
                    currency: res.currency ?? "USD",
                    status: (res.status as "captured" | "already_captured") ?? "captured",
                });
            } catch (e) {
                release(lockKey, false);
                setState({
                    phase: "error",
                    message: "Something went wrong while capturing your donation.",
                });
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [orderId]);

    const goHome = () => navigate("/");
    const goGive = () => navigate("/donations");

    // ---------- render ----------
    if (state.phase === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Finalizing Donation</h2>
                            <p className="text-gray-600">We’re capturing your payment with PayPal…</p>
                            <div className="mt-4 text-sm text-gray-500">
                                <p>Order ID: {orderId || "—"}</p>
                            </div>
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
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Processing Failed</h2>
                            <Alert variant="destructive" className="mb-6 text-left">
                                <AlertDescription>{state.message}</AlertDescription>
                            </Alert>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button onClick={goGive} variant="outline" className="w-full sm:w-auto">
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

    // success
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4">
                <Card className="border-green-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="h-6 w-6" />
                            Donation Successful
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Payment {state.status === "already_captured" ? "Previously Captured" : "Captured"}
                            </Badge>
                            <Badge variant="secondary">PayPal</Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="orderId">PayPal Order ID</Label>
                                <Input id="orderId" readOnly value={state.order_id || orderId} />
                            </div>
                            <div>
                                <Label htmlFor="payerId">Payer ID</Label>
                                <Input id="payerId" readOnly value={payerId || "—"} />
                            </div>
                            <div>
                                <Label htmlFor="captureId">Capture ID</Label>
                                <Input id="captureId" readOnly value={state.capture_id || "—"} />
                            </div>
                            <div>
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    readOnly
                                    value={
                                        typeof state.captured_amount === "number"
                                            ? `$${state.captured_amount.toFixed(2)} ${state.currency || "USD"}`
                                            : "—"
                                    }
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                            <div className="flex gap-2">
                                <Button onClick={goGive} className="flex items-center">
                                    <CircleDollarSign className="h-4 w-4 mr-2" />
                                    Give Again
                                </Button>
                                <Button onClick={goHome} variant="outline" className="flex items-center">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Home
                                </Button>
                            </div>

                            <Button
                                variant="secondary"
                                onClick={() => window.open(`https://www.paypal.com/activity/payment/${state.capture_id || state.order_id}`, "_blank")}
                                disabled={!state.capture_id && !state.order_id}
                            >
                                View in PayPal
                                <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OnetimeDonationSuccess;
