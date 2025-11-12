// Payment options a form can expose in its config
export type FormPaymentOption = "paypal" | "door";

// What a single submission’s payment looks like (always present)
export type FormPaymentType = "free" | "paypal" | "door";

export type FormResponsePaymentDetails = {
    payment_type: FormPaymentType;
    price: number;
    payment_complete: boolean;
    transaction_id: string | null;
    currency?: string | null;         // default "USD" server-side
    captured_amount?: number | null;  // when PayPal capture returns an amount
};

// The authoring schema for a Form’s field set is dynamic JSON;
// keep it loose to avoid brittle coupling.
export type FormSchemaField = Record<string, any>;

// Minimal localization support (matches backend’s supported_locales list)
export type LocaleCode = string;

// Public/authoring-facing form (matches GET /forms/slug/{slug} and mod/private reads)
export type Form = {
    id: string;
    title: string;
    ministries: string[];
    description?: string | null;
    user_id: string;
    visible: boolean;
    slug?: string | null;
    data: FormSchemaField[];     // builder JSON
    expires_at?: string | null;  // ISO
    created_at: string;          // ISO
    updated_at: string;          // ISO
    form_width?: string | null;  // "100" | "85" | ...
    supported_locales: LocaleCode[];

    // Payment configuration (derived from the `price` component in schema)
    submission_price: number;             // 0 for free forms
    payment_options: FormPaymentOption[]; // [] for free forms, else subset of ["paypal","door"]
};

// Client payload for posting a response. The response body is free-form,
// but we always tuck the `payment` object at the top level when present.
export type FormSubmissionBody = {
    // dynamic answers keyed by field name; include localized keys if your UI uses them
    [k: string]: any;

    // Always include a payment object — even for free — to keep the server doc shape uniform.
    payment: FormResponsePaymentDetails;
};

// Standard success envelope from the legacy responses endpoint
export type FormSubmissionResult = {
    message: string;   // "Response recorded"
    response_id: string;
};

// Create-order response from /forms/payments/create
export type CreateFormOrderResponse = {
    order_id: string;
    paypal: Record<string, any>; // raw order blob (use approve link from here if you need)
    amount: number;
    currency: string;
};

// (LEGACY) Capture response from /forms/payments/capture
// Kept for backward-compat if any code still references it.
export type CaptureFormOrderResponse = {
    order_id: string;
    status: string;                 // PayPal status, e.g. "COMPLETED"
    capture_id?: string | null;
    captured_amount?: number | null;
    paypal: Record<string, any>;    // raw capture blob
};

// NEW: Combined capture + submit response from /forms/payments/capture-and-submit
export type CaptureAndSubmitFormResponse = {
    status: "captured_and_submitted" | "already_captured" | "already_processed";
    order_id: string;
    transaction_id: string | null;
    // The saved response document; schema is flexible. If you formalize this later,
    // replace `any` with a typed shape.
    response: any;
};
