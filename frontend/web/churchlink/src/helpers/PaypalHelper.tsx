import api from "../api/api";

export type IntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface PaypalContent {
    title?: string;
    subtitle?: string;
    buttonText?: string;
    amount?: number;
    message?: string;
    backgroundImageUrl?: string;
    purpose?: string;
    isSubscription?: boolean;
    cycles?: number;
    startDate?: string;
    interval_unit?: IntervalUnit;
    interval_count?: number;
}

export interface PaypalSettingsResponse {
    settings?: {
        ALLOWED_FUNDS?: string[];
    };
}

export interface PaypalDonationPayload {
    donation: {
        fund_name: string;
        amount?: number;
        message?: string;
        return_url?: string;
        cancel_url?: string;
    };
}

export interface PaypalSubscriptionDonation {
    fund_name: string;
    amount?: number;
    message?: string;
    interval_unit?: IntervalUnit;
    interval_count?: number;
    cycles?: number;
    start_date?: string;
    first_name?: string;
    last_name?: string;
    return_url?: string;
    cancel_url?: string;
}

export interface PaypalOrderResponse {
    approval_url?: string;
    [k: string]: unknown;
}

export interface PaypalSubscriptionResponse {
    approval_url?: string;
    [k: string]: unknown;
}

export interface PaypalCaptureResponse {
    approval_url?: string;
    transaction_id?: string;
    amount?: number | string;
    fund_name?: string;
    user_email?: string;
    status?: string;
    // keep open-ended
    [k: string]: unknown;
}

export interface PaypalExecuteSubResponse {
    approval_url?: string;
    id?: string;
    subscription_id?: string;
    agreement?: { id?: string; state?: string;[k: string]: unknown };
    status?: string;
    state?: string;
    description?: string;
    start_date?: string;
    execution_details?: Record<string, unknown>;
    subscriber?: Record<string, unknown>;
    payer?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    agreement_details?: Record<string, unknown>;
    links?: { href: string }[];
    [k: string]: unknown;
};

// Parses the PayPal return query string and tells us what flow it is
export const parsePayPalReturn = (search: string) => {
    const params = new URLSearchParams(search);
    const paymentId = params.get("paymentId") || params.get("payment_id");
    const payerId = params.get("PayerID") || params.get("payer_id");
    const token = params.get("token");
    return { paymentId: paymentId ?? null, payerId: payerId ?? null, token: token ?? null };
};

export const getPayPalSettings = async (): Promise<string[]> => {
    try {
        const res = await api.get<PaypalSettingsResponse>("/api/paypal/settings");
        return res.data?.settings?.ALLOWED_FUNDS ?? ["General", "Building", "Missions", "Youth", "Other"];
    } catch (err) {
        console.warn("Failed to fetch PayPal settings, using defaults:", err);
        return ["General", "Building", "Missions", "Youth", "Other"];
    }
};

export const createPayPalOrder = async (
    payload: PaypalDonationPayload
): Promise<PaypalOrderResponse | null> => {
    try {
        const res = await api.post<PaypalOrderResponse>("/api/paypal/orders", payload, {
            headers: { "Content-Type": "application/json" },
        });
        return res.data ?? null;
    } catch (err) {
        console.error("Error creating PayPal order:", err);
        return null;
    }
};

export const createPayPalSubscription = async (
    donation: PaypalSubscriptionDonation
): Promise<PaypalSubscriptionResponse | null> => {
    try {
        const res = await api.post<PaypalSubscriptionResponse>(
            "/api/paypal/subscription",
            { donation },
            { headers: { "Content-Type": "application/json" } }
        );
        return res.data ?? null;
    } catch (err) {
        console.error("Subscription creation error:", err);
        return null;
    }
};

// Capture a one-time order
export const capturePayPalOrder = async (
    paymentId: string,
    payerId: string
): Promise<PaypalCaptureResponse | null> => {
    try {
        const path = `/api/paypal/orders/${encodeURIComponent(paymentId)}/capture?payer_id=${encodeURIComponent(
            payerId
        )}`;
        const res = await api.post<PaypalCaptureResponse>(path);
        return res.data ?? null;
    } catch (err) {
        // leave console noise to caller’s error UI
        return Promise.reject(err);
    }
};

// Execute a subscription (token-based)
export const executePayPalSubscription = async (
    token: string
): Promise<PaypalExecuteSubResponse | null> => {
    try {
        const path = `/api/paypal/subscription/execute?token=${encodeURIComponent(token)}`;
        const res = await api.post<PaypalExecuteSubResponse>(path);
        return res.data ?? null;
    } catch (err) {
        return Promise.reject(err);
    }
};

// Utilities
export const toStartDateISO = (value?: string): string => {
    if (!value) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString();
    }
    const hasDash = value.includes("-");
    if (!hasDash) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString();
    }
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString();
    }
    if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString();
    }
    const target = new Date(y, m - 1, d, 12, 0, 0);
    return target.toISOString();
};

export const getReturnUrl = (): string => `${window.location.origin}/thank-you`;
export const getCancelUrl = (): string => `${window.location.origin}${window.location.pathname}`;
