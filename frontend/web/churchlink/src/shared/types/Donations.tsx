// THIS FILE CONTAINS TYPES FOR ONE-TIME AND RECURRING DONATIONS.

export type DonationCurrency = "USD"
export type DonationInterval = "WEEK" | "MONTH" | "YEAR"

export type CreateOneTimeDonationRequest = {
    amount: number;
    currency?: DonationCurrency;
    message?: string | null;
    merchant_org_id?: string | null;
};

export type CreateOneTimeDonationResponse = {
    success: boolean;
    msg?: string;
    order_id?: string;
    approve_url?: string; // extracted from PayPal links, if present
};

export type CaptureOneTimeDonationRequest = {
    order_id: string;
};

export type CaptureOneTimeDonationResponse = {
    success: boolean;
    msg?: string;
    status?: "captured" | "already_captured";
    order_id?: string;
    capture_id?: string;
    captured_amount?: number | null;
    currency?: DonationCurrency;
};

export type CreateDonationSubscriptionRequest = {
    amount: number;
    currency?: DonationCurrency;
    interval: DonationInterval;
    message?: string | null;
    merchant_org_id?: string | null;
};

export type CreateDonationSubscriptionResponse = {
    success: boolean;
    msg?: string;
    subscription_id?: string;
    status?: "APPROVAL_PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
    approve_url?: string; // approval link for redirect
};
