import api from "../api/api";
import type {
    ChangeEventRegistration,
    RegistrationChangeResponse,
    CreatePaidRegistrationResponse,
    RegistrationDetails,
    EventPaymentType,
    DiscountCodeCheckRequest,
    DiscountCodeCheckResponse
} from "@/shared/types/Event";


export async function changeRegistration(
    details: ChangeEventRegistration
): Promise<RegistrationChangeResponse> {
    try {
        if (!details?.event_instance_id) {
            return { success: false, msg: "Missing event_instance_id" };
        }

        const isAdding =
            details.self_registered === true ||
            (Array.isArray(details.family_members_registering) &&
                details.family_members_registering.length > 0);

        if (isAdding && !details.payment_type) {
            return {
                success: false,
                msg: "Missing payment_type for add-registration request",
            };
        }

        const res = await api.put("/v1/events-registrations/change-registration", details);

        const data = (res?.data ?? {}) as RegistrationChangeResponse & {
            order_id?: string;
            approve_url?: string;
        };

        if (typeof data?.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        if (data.success && data.order_id && data.approve_url) {
            return {
                success: true,
                msg: data.msg,
                seats_filled: data.seats_filled,
                order_id: data.order_id,
                approve_url: data.approve_url,
            } as unknown as RegistrationChangeResponse;
        }

        return {
            success: data.success,
            msg: data.msg ?? (data.success ? "OK" : "Failed"),
            seats_filled: data.seats_filled,
            registration_details: (data as any).registration_details ?? null,
        };
    } catch (err) {
        console.error("[EventRegistrationHelper] changeRegistration() -> error", err);
        return { success: false, msg: "Registration update failed" };
    }
}


export async function createPaidRegistration(
    details: ChangeEventRegistration
): Promise<CreatePaidRegistrationResponse> {
    try {
        if (!details?.event_instance_id) {
            return { success: false, msg: "Missing event_instance_id" };
        }

        const isAdding =
            details.self_registered === true ||
            (Array.isArray(details.family_members_registering) &&
                details.family_members_registering.length > 0);

        if (!isAdding) {
            return { success: false, msg: "Cannot create a paid order without new registrants" };
        }
        if ((details.payment_type as EventPaymentType) !== "paypal") {
            return { success: false, msg: "payment_type must be 'paypal' to create a paid order" };
        }

        const res = await api.put("/v1/events-registrations/change-registration", details);
        const data = (res?.data ?? {}) as CreatePaidRegistrationResponse;

        if (typeof data.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        if (!data.success) {
            return { success: false, msg: data.msg || "Failed to create payment order" };
        }
        if (!data.approve_url || !data.order_id) {
            return { success: false, msg: "Missing approval link or order id" };
        }

        return {
            success: true,
            order_id: data.order_id,
            approve_url: data.approve_url,
            msg: data.msg,
        };
    } catch (err) {
        console.error("[EventRegistrationHelper] createPaidRegistration() -> error", err);
        return { success: false, msg: "Could not create payment order" };
    }
}


export async function capturePaidRegistration(
    orderId: string,
    event_instance_id: string,
    finalDetails: RegistrationDetails
): Promise<RegistrationChangeResponse> {
    try {
        if (!orderId || !event_instance_id) {
            return { success: false, msg: "Missing orderId or event_instance_id" };
        }
        if (!finalDetails || typeof finalDetails.self_registered !== "boolean") {
            return { success: false, msg: "Missing or invalid final registration details" };
        }

        const res = await api.put("/v1/events-registrations/capture-paid-reg", {
            order_id: orderId,
            event_instance_id,
            final_details: finalDetails,
        });

        const data = (res?.data ?? {}) as RegistrationChangeResponse;
        if (typeof data?.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        return data;
    } catch (err) {
        console.error("[EventRegistrationHelper] capturePaidRegistration() -> error", err);
        return { success: false, msg: "Payment capture failed" };
    }
}

export async function validateDiscountCodeForEvent(
    payload: DiscountCodeCheckRequest
): Promise<DiscountCodeCheckResponse> {
    try {
        if (!payload?.event_id || !payload?.discount_code) {
            return { success: false, msg: "Missing event_id or code" };
        }

        const res = await api.post(
            "/v1/events-registrations/validate-discount-code",
            payload,
        );
        const data = (res?.data ?? {}) as DiscountCodeCheckResponse;

        if (typeof data.success !== "boolean") {
            return { success: false, msg: "Invalid response from server" };
        }
        return data;
    } catch (err) {
        console.error("[EventRegistrationHelper] validateDiscountCodeForEvent() -> error", err);
        return { success: false, msg: "Could not validate discount code" };
    }
}
