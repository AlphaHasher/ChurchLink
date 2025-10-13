import api from "../api/api";
import { MembershipDetails, MembershipRequest, ReadMembershipRequest } from "@/shared/types/MembershipRequests";

export type MembershipSearchParams = {
    page: number;
    pageSize: number;
    searchField: "email" | "name" | "message";
    searchTerm: string;
    sortBy: "created_on" | "resolved" | "approved";
    sortDir: "asc" | "desc";
    status: "pending" | "approved" | "rejected";
};

export type MembershipSearchResponse = {
    success: boolean;
    items: MembershipRequest[];
    total: number;
    page: number;
    pageSize: number;
};

export const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "");

export async function fetchMembershipRequestsPaged(
    params: MembershipSearchParams,
    signal?: AbortSignal
): Promise<MembershipSearchResponse> {
    const res = await api.get<MembershipSearchResponse>("/v1/membership/search-requests", {
        params,
        signal,
    });
    return res.data;
}

export async function createMembershipRequest(optional_message?: string) {
    try {
        const payload = { message: optional_message };
        const res = await api.post("/v1/membership/create-request", payload);
        return { success: res.data?.success === true, msg: res.data?.msg ?? "" };
    } catch (err) {
        console.error("Failed to create membership request:", err);
        return { success: false, msg: "Failed to create membership request." };
    }
}

export async function respondToMembershipRequest(uid: string, approved: boolean, muted: boolean, reason?: string) {
    try {
        const payload = { uid, approved, muted, reason };
        const res = await api.patch("/v1/membership/respond-to-request", payload);
        return { success: res.data?.success === true, msg: res.data?.msg ?? "" };
    } catch (err) {
        console.error("Failed to respond to membership request:", err);
        return { success: false, msg: "Failed to respond to membership request." };
    }
}


export const readMembershipDetails = async (): Promise<MembershipDetails> => {
    try {
        const res = await api.get("v1/membership/membership-details");

        if (res.data.details['pending_request'] == null) {
            let ret: MembershipDetails = {
                membership: res.data.details.membership,
                pending_request: null,
            }
            return ret;
        }
        else {
            const pend = res.data.details['pending_request'];
            let req: ReadMembershipRequest = {
                approved: pend['approved'] ?? null,
                message: pend['message'] ?? null,
                muted: pend['muted'],
                reason: pend['reason'] ?? null,
                resolved: pend['resolved'],
            };

            let ret: MembershipDetails = {
                membership: res.data.details['membership'],
                pending_request: req
            };
            return ret;
        }
    } catch (err) {
        console.error("Failed to respond to read membership details:", err);
        let ret: MembershipDetails = {
            membership: false,
            pending_request: null,
        };
        return ret;
    }

}
