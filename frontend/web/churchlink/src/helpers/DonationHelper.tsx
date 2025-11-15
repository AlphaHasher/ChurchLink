import api from "../api/api";
import type {
    CreateOneTimeDonationRequest,
    CreateOneTimeDonationResponse,
    CaptureOneTimeDonationRequest,
    CaptureOneTimeDonationResponse,
    CreateDonationSubscriptionRequest,
    CreateDonationSubscriptionResponse,
    CancelDonationSubscriptionRequest,
    CancelDonationSubscriptionResponse,
    AdminCancelDonationSubscriptionRequest,
    AdminCancelDonationSubscriptionResponse,
    AdminRefundOneTimeDonationRequest,
    AdminRefundOneTimeDonationResponse,
    AdminRefundDonationSubscriptionPaymentRequest,
    AdminRefundDonationSubscriptionPaymentResponse,
} from "@/shared/types/Donations";

// -------------------------------------------------------
// User-facing helpers
// -------------------------------------------------------

// Create a one-time PayPal order for a donation
export async function createOneTimeDonation(
    payload: CreateOneTimeDonationRequest,
): Promise<CreateOneTimeDonationResponse> {
    try {
        if (!payload || typeof payload.amount !== "number" || payload.amount <= 0) {
            return { success: false, msg: "Invalid amount" };
        }
        const res = await api.post("/v1/donations/one-time/create", {
            amount: payload.amount,
            currency: payload.currency ?? "USD",
            message: payload.message ?? null,
        });

        const data = (res?.data ?? {}) as {
            order_id?: string;
            paypal?: { links?: Array<{ rel?: string; href?: string }> };
            amount?: number;
            currency?: string;
        };

        if (!data?.order_id) {
            return {
                success: false,
                msg: "Invalid response from server (missing order id)",
            };
        }

        let approve_url: string | undefined = undefined;
        const links = Array.isArray(data?.paypal?.links)
            ? data.paypal!.links!
            : [];
        for (const l of links) {
            if (l?.rel === "approve" && typeof l?.href === "string") {
                approve_url = l.href;
                break;
            }
        }

        return {
            success: true,
            order_id: data.order_id,
            approve_url,
            msg: "Order created",
        };
    } catch (err) {
        console.error("[DonationHelper] createOneTimeDonation() -> error", err);
        return { success: false, msg: "Failed to create donation order" };
    }
}

// Capture a previously-approved PayPal order
export async function captureOneTimeDonation(
    payload: CaptureOneTimeDonationRequest,
): Promise<CaptureOneTimeDonationResponse> {
    try {
        if (!payload?.order_id) {
            return { success: false, msg: "Missing order_id" };
        }

        const res = await api.post("/v1/donations/one-time/capture", {
            order_id: payload.order_id,
        });

        const data = (res?.data ?? {}) as {
            status?: "captured" | "already_captured";
            order_id?: string;
            capture_id?: string;
            captured_amount?: number;
            currency?: string;
        };

        if (!data?.status || !data?.order_id) {
            return { success: false, msg: "Invalid response from server" };
        }

        return {
            success: true,
            status: data.status,
            order_id: data.order_id,
            capture_id: data.capture_id,
            captured_amount:
                typeof data.captured_amount === "number"
                    ? data.captured_amount
                    : null,
            currency: (data.currency as any) ?? "USD",
        };
    } catch (err) {
        console.error("[DonationHelper] captureOneTimeDonation() -> error", err);
        return { success: false, msg: "Failed to capture donation" };
    }
}

// Create a subscription for recurring donations and return approval URL
export async function createDonationSubscription(
    payload: CreateDonationSubscriptionRequest,
): Promise<CreateDonationSubscriptionResponse> {
    try {
        if (!payload || typeof payload.amount !== "number" || payload.amount <= 0) {
            return { success: false, msg: "Invalid amount" };
        }
        if (!payload.interval || !["WEEK", "MONTH", "YEAR"].includes(payload.interval)) {
            return { success: false, msg: "Invalid interval" };
        }

        const res = await api.post("/v1/donations/subscription/create", {
            amount: payload.amount,
            currency: payload.currency ?? "USD",
            interval: payload.interval,
            message: payload.message ?? null,
        });

        const data = (res?.data ?? {}) as {
            subscription_id?: string;
            status?:
            | "APPROVAL_PENDING"
            | "ACTIVE"
            | "SUSPENDED"
            | "CANCELLED"
            | "EXPIRED";
            approve_url?: string;
        };

        if (!data?.subscription_id) {
            return {
                success: false,
                msg: "Invalid response from server (missing subscription id)",
            };
        }

        return {
            success: true,
            subscription_id: data.subscription_id,
            status: data.status,
            approve_url: data.approve_url,
            msg: "Subscription created",
        };
    } catch (err) {
        console.error(
            "[DonationHelper] createDonationSubscription() -> error",
            err,
        );
        return {
            success: false,
            msg: "Failed to create donation subscription",
        };
    }
}

export async function cancelDonationSubscription(
    payload: CancelDonationSubscriptionRequest,
): Promise<CancelDonationSubscriptionResponse> {
    try {
        if (!payload.subscription_id) {
            return { success: false, msg: "Missing subscription id" };
        }

        const res = await api.post("/v1/donations/subscription/cancel", {
            subscription_id: payload.subscription_id,
        });

        const data = (res?.data ?? {}) as CancelDonationSubscriptionResponse;
        if (!data.success) {
            return {
                success: false,
                msg: data.msg ?? "Unable to cancel subscription.",
                status: data.status,
            };
        }

        return data;
    } catch (err) {
        console.error(
            "[DonationHelper] cancelDonationSubscription() -> error",
            err,
        );
        return {
            success: false,
            msg: "Unexpected error cancelling subscription.",
        };
    }
}

// -------------------------------------------------------
// Admin helpers
// -------------------------------------------------------

// Admin: cancel any user's donation subscription
export async function adminCancelDonationSubscription(
    payload: AdminCancelDonationSubscriptionRequest,
): Promise<AdminCancelDonationSubscriptionResponse> {
    try {
        if (!payload.subscription_id) {
            return { success: false, msg: "Missing subscription id" };
        }

        const res = await api.post("/v1/admin-donations/subscription/cancel", {
            subscription_id: payload.subscription_id,
        });

        const data = (res?.data ?? {}) as CancelDonationSubscriptionResponse;

        if (!data.success) {
            return {
                success: false,
                msg: data.msg ?? "Unable to cancel subscription.",
                status: data.status,
            };
        }

        return data as AdminCancelDonationSubscriptionResponse;
    } catch (err) {
        console.error(
            "[DonationHelper] adminCancelDonationSubscription() -> error",
            err,
        );
        return {
            success: false,
            msg: "Unexpected error cancelling subscription (admin).",
        };
    }
}

// Admin: refund a one-time donation by capture id
// If amount is omitted => full refund; otherwise partial.
export async function adminRefundOneTimeDonation(
    payload: AdminRefundOneTimeDonationRequest,
): Promise<AdminRefundOneTimeDonationResponse> {
    try {
        if (!payload.paypal_capture_id) {
            return { success: false, msg: "Missing paypal_capture_id" };
        }

        const body: Record<string, any> = {
            paypal_capture_id: payload.paypal_capture_id,
        };
        if (typeof payload.amount === "number" && payload.amount > 0) {
            body.amount = payload.amount;
        }
        if (payload.reason) {
            body.reason = payload.reason;
        }

        const res = await api.post("/v1/admin-donations/one-time/refund", body);
        const raw = (res?.data ?? {}) as any;

        const success = !!raw.success;
        return {
            success,
            msg:
                raw.msg ??
                (success
                    ? "Refund successfully initiated."
                    : "Unable to refund donation."),
            paypal_capture_id: raw.paypal_capture_id,
            paypal_refund: raw.paypal_refund,
        };
    } catch (err) {
        console.error(
            "[DonationHelper] adminRefundOneTimeDonation() -> error",
            err,
        );
        return {
            success: false,
            msg: "Unexpected error refunding one-time donation.",
        };
    }
}

// Admin: refund a single subscription payment by PayPal txn (sale id)
// If amount is omitted => full refund; otherwise partial.
export async function adminRefundDonationSubscriptionPayment(
    payload: AdminRefundDonationSubscriptionPaymentRequest,
): Promise<AdminRefundDonationSubscriptionPaymentResponse> {
    try {
        if (!payload.paypal_txn_id) {
            return { success: false, msg: "Missing paypal_txn_id" };
        }

        const body: Record<string, any> = {
            paypal_txn_id: payload.paypal_txn_id,
        };
        if (typeof payload.amount === "number" && payload.amount > 0) {
            body.amount = payload.amount;
        }
        if (payload.reason) {
            body.reason = payload.reason;
        }

        const res = await api.post(
            "/v1/admin-donations/subscription-payment/refund",
            body,
        );
        const raw = (res?.data ?? {}) as any;

        const success = !!raw.success;
        return {
            success,
            msg:
                raw.msg ??
                (success
                    ? "Subscription payment refund initiated."
                    : "Unable to refund subscription payment."),
            paypal_txn_id: raw.paypal_txn_id,
            paypal_refund: raw.paypal_refund,
        };
    } catch (err) {
        console.error(
            "[DonationHelper] adminRefundDonationSubscriptionPayment() -> error",
            err,
        );
        return {
            success: false,
            msg: "Unexpected error refunding subscription payment.",
        };
    }
}
