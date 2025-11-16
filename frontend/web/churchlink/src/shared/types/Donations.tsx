// THIS FILE CONTAINS TYPES FOR ONE-TIME AND RECURRING DONATIONS.

export type DonationCurrency = "USD";
export type DonationInterval = "WEEK" | "MONTH" | "YEAR";

// -----------------------------
// User-facing one-time donations
// -----------------------------

export type CreateOneTimeDonationRequest = {
    amount: number;
    currency?: DonationCurrency;
    message?: string | null;
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

// -----------------------------
// User-facing recurring donations
// -----------------------------

export type CreateDonationSubscriptionRequest = {
    amount: number;
    currency?: DonationCurrency;
    interval: DonationInterval;
    message?: string | null;
};

export type CreateDonationSubscriptionResponse = {
    success: boolean;
    msg?: string;
    subscription_id?: string;
    status?: "APPROVAL_PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
    approve_url?: string; // approval link for redirect
};

export type CancelDonationSubscriptionRequest = {
    subscription_id: string;
};

export type CancelDonationSubscriptionResponse = {
    success: boolean;
    msg?: string;
    status?: "APPROVAL_PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
};

// -----------------------------
// Admin operations
// -----------------------------

// Admin cancels any user's donation subscription.
// Shape is intentionally the same as user cancel, we just hit a different route.
export type AdminCancelDonationSubscriptionRequest = {
    subscription_id: string;
};

export type AdminCancelDonationSubscriptionResponse =
    CancelDonationSubscriptionResponse;

// Admin refunds a one-time donation by capture id.
// `amount` omitted => full refund; otherwise partial refund of that amount.
export type AdminRefundOneTimeDonationRequest = {
    paypal_capture_id: string;
    amount?: number | null;
    reason?: string | null;
};

export type AdminRefundOneTimeDonationResponse = {
    success: boolean;
    msg?: string;
    paypal_capture_id?: string;
    paypal_refund?: any; // raw PayPal refund payload (for logs / debugging)
};

// Admin refunds a single subscription payment by sale/txn id.
// `amount` omitted => full refund; otherwise partial refund.
export type AdminRefundDonationSubscriptionPaymentRequest = {
    paypal_txn_id: string;
    amount?: number | null;
    reason?: string | null;
};

export type AdminRefundDonationSubscriptionPaymentResponse = {
    success: boolean;
    msg?: string;
    paypal_txn_id?: string;
    paypal_refund?: any; // raw PayPal refund payload
};
