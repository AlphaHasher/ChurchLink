import api from "../api/api";
import type {
    Form,
    FormPaymentOption,
    FormPaymentType,
    FormResponsePaymentDetails,
    FormSubmissionBody,
    FormSubmissionResult,
    CreateFormOrderResponse,
    CaptureAndSubmitFormResponse,
    AdminRefundFormPaymentRequest,
    AdminRefundFormPaymentResponse,
} from "@/shared/types/Form";

// Fetch a public, visible form by slug (Authorization required by backend)
export async function getFormBySlug(slug: string): Promise<Form> {
    const res = await api.get(`/v1/forms/slug/${encodeURIComponent(slug)}`);
    // Server throws HTTP errors for not found / not visible / expired
    return res.data as Form;
}

// Convenience: is this form free?
export function isFreeForm(form: Pick<Form, "submission_price">): boolean {
    return !form || Number(form.submission_price || 0) <= 0;
}

// Convenience: which payment methods are allowed?
export function allowedPaymentOptions(
    form: Pick<Form, "payment_options">
): FormPaymentOption[] {
    return Array.isArray(form?.payment_options) ? form.payment_options : [];
}

// Build the normalized payment details the server expects on ALL submissions.
export function normalizePaymentDetails(
    form: Pick<Form, "submission_price" | "payment_options">,
    chosenType: FormPaymentType | null,
    opts?: {
        transaction_id?: string | null;
        captured_amount?: number | null;
        currency?: string | null;
        overridePrice?: number | null; // rarely used; defaults to form.submission_price
    }
): FormResponsePaymentDetails {
    const price = Number(
        typeof opts?.overridePrice === "number"
            ? opts.overridePrice
            : form.submission_price || 0
    );

    if (isFreeForm(form)) {
        return {
            payment_type: "free",
            price: 0,
            payment_complete: true,
            transaction_id: null,
            currency: opts?.currency ?? "USD",
            captured_amount: 0,
        };
    }

    // Paid forms: must honor the form’s allowed options
    const allowed = new Set(allowedPaymentOptions(form));
    const type: FormPaymentType =
        chosenType && allowed.has(chosenType as any)
            ? chosenType
            : allowed.has("paypal")
                ? "paypal"
                : "door";

    return {
        payment_type: type,
        price,
        payment_complete: false,
        transaction_id: opts?.transaction_id ?? null,
        currency: opts?.currency ?? "USD",
        captured_amount: opts?.captured_amount ?? null,
    };
}

export async function createFormPaymentOrder(
    slug: string,
    answers: Record<string, any>
): Promise<CreateFormOrderResponse> {
    const res = await api.post("/v1/forms/payments/create", { slug, answers });
    return res.data as CreateFormOrderResponse;
}


export async function captureAndSubmitFormPayment(
    slug: string,
    orderId: string,
    answers: Record<string, any>
): Promise<CaptureAndSubmitFormResponse> {
    const res = await api.post("/v1/forms/payments/capture-and-submit", {
        slug,
        order_id: orderId,
        answers,
    });
    return res.data as CaptureAndSubmitFormResponse;
}

export async function submitFormResponse(
    slug: string,
    answers: Record<string, any>,
    payment: FormResponsePaymentDetails
): Promise<FormSubmissionResult> {
    const res = await api.post(`/v1/forms/slug/${encodeURIComponent(slug)}/responses`, {
        ...answers,
        payment,
    } as FormSubmissionBody);
    return res.data as FormSubmissionResult;
}

/**
 * Full happy-path for a PAID (PayPal) form using the NEW combined endpoint:
 * 1) create order
 * 2) redirect user to PayPal to approve (use the approve link from `order.paypal.links`)
 * 3) call captureAndSubmitFormPayment(slug, order_id, answers) ONE TIME
 *
 * Returns the saved response envelope produced by the backend.
 */
export async function submitPaidFormViaPayPal(
    slug: string,
    answers: Record<string, any>,
    _form: Pick<Form, "submission_price" | "payment_options">
): Promise<CaptureAndSubmitFormResponse> {
    // Step 1: create a PayPal order using the current answers so server can compute price
    const order = await createFormPaymentOrder(slug, answers);

    // Step 2: caller should redirect to PayPal approval UI using order.paypal.links
    // After approval, the success page should call the single endpoint below:
    return await captureAndSubmitFormPayment(slug, order.order_id, answers);
}

/**
 * Free form shortcut (no PayPal). Uses the legacy responses endpoint.
 */
export async function submitFreeForm(
    slug: string,
    answers: Record<string, any>,
    form: Pick<Form, "submission_price" | "payment_options">
): Promise<FormSubmissionResult> {
    const payment = normalizePaymentDetails(form, "free");
    return await submitFormResponse(slug, answers, payment);
}

/**
 * “Pay at the door” shortcut (unpaid). Uses the legacy responses endpoint.
 */
export async function submitDoorPaymentForm(
    slug: string,
    answers: Record<string, any>,
    form: Pick<Form, "submission_price" | "payment_options">
): Promise<FormSubmissionResult> {
    const payment = normalizePaymentDetails(form, "door");
    // door payments are intentionally not complete on submission
    payment.payment_complete = false;
    return await submitFormResponse(slug, answers, payment);
}

/**
 * Admin: refund a PayPal-backed form payment.
 * - If amount is omitted => full refund
 * - If amount is provided => partial refund of that amount
 */
export async function adminRefundFormPayment(
    payload: AdminRefundFormPaymentRequest,
): Promise<AdminRefundFormPaymentResponse> {
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

        const res = await api.post("/v1/admin/forms/payments/refund", body);
        const raw = (res?.data ?? {}) as any;

        const success = !!raw.success;
        return {
            success,
            msg:
                raw.msg ??
                (success
                    ? "Form payment refund initiated."
                    : "Unable to refund form payment."),
            paypal_capture_id: raw.paypal_capture_id,
            paypal_refund: raw.paypal_refund,
        };
    } catch (err) {
        console.error(
            "[FormSubmissionHelper] adminRefundFormPayment() -> error",
            err,
        );
        return {
            success: false,
            msg: "Unexpected error refunding form payment.",
        };
    }
}

export async function adminMarkFormResponsePaid(
    formId: string,
    opts: { responseId?: string | null; submittedAt?: string | null }
): Promise<{ success: boolean; msg?: string }> {
    try {
        const body: Record<string, any> = {
            form_id: formId,
        };

        if (opts.responseId) {
            body.response_id = opts.responseId;
        }

        // Keep submitted_at as a fallback for old responses without ids
        if (opts.submittedAt) {
            body.submitted_at = opts.submittedAt;
        }

        const res = await api.post("/v1/admin/forms/payments/mark-paid", body);
        const data = res.data as { success: boolean; msg?: string };
        return data;
    } catch (err: any) {
        console.error(
            "[FormSubmissionHelper] adminMarkFormResponsePaid() -> error",
            err,
        );
        const detail =
            err?.response?.data?.detail ||
            err?.message ||
            "Unexpected error marking response as paid.";
        return { success: false, msg: detail };
    }
}
