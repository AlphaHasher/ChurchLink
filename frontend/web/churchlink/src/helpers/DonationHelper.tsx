import api from "../api/api";
import type {
    CreateOneTimeDonationRequest,
    CreateOneTimeDonationResponse,
    CaptureOneTimeDonationRequest,
    CaptureOneTimeDonationResponse,
    CreateDonationSubscriptionRequest,
    CreateDonationSubscriptionResponse,
} from "@/shared/types/Donations";

// Create a one-time PayPal order for a donation
export async function createOneTimeDonation(
    payload: CreateOneTimeDonationRequest
): Promise<CreateOneTimeDonationResponse> {
    try {
        if (!payload || typeof payload.amount !== "number" || payload.amount <= 0) {
            return { success: false, msg: "Invalid amount" };
        }
        const res = await api.post("/v1/donations/one-time/create", {
            amount: payload.amount,
            currency: (payload.currency ?? "USD"),
            message: payload.message ?? null,
            merchant_org_id: payload.merchant_org_id ?? null,
        });

        const data = (res?.data ?? {}) as {
            order_id?: string;
            paypal?: { links?: Array<{ rel?: string; href?: string }> };
            amount?: number;
            currency?: string;
        };

        if (!data?.order_id) {
            return { success: false, msg: "Invalid response from server (missing order id)" };
        }

        let approve_url: string | undefined = undefined;
        const links = Array.isArray(data?.paypal?.links) ? data.paypal!.links! : [];
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
    payload: CaptureOneTimeDonationRequest
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
            captured_amount: typeof data.captured_amount === "number" ? data.captured_amount : null,
            currency: (data.currency as any) ?? "USD",
        };
    } catch (err) {
        console.error("[DonationHelper] captureOneTimeDonation() -> error", err);
        return { success: false, msg: "Failed to capture donation" };
    }
}

// Create a subscription for recurring donations and return approval URL
export async function createDonationSubscription(
    payload: CreateDonationSubscriptionRequest
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
            currency: (payload.currency ?? "USD"),
            interval: payload.interval,
            message: payload.message ?? null,
            merchant_org_id: payload.merchant_org_id ?? null,
        });

        const data = (res?.data ?? {}) as {
            subscription_id?: string;
            status?: "APPROVAL_PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
            approve_url?: string;
        };

        if (!data?.subscription_id) {
            return { success: false, msg: "Invalid response from server (missing subscription id)" };
        }

        return {
            success: true,
            subscription_id: data.subscription_id,
            status: data.status,
            approve_url: data.approve_url,
            msg: "Subscription created",
        };
    } catch (err) {
        console.error("[DonationHelper] createDonationSubscription() -> error", err);
        return { success: false, msg: "Failed to create donation subscription" };
    }
}
