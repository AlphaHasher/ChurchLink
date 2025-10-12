export type MembershipRequestHistoryItem = {
    message: string | null;
    resolved: boolean;
    approved: boolean | null;
    reason: string | null;
    muted: boolean;
    created_on: string;
    responded_to: string | null;
};

export type MembershipRequest = {
    uid: string;
    first_name: string;
    last_name: string;
    email: string;
    message: string | null;
    resolved: boolean;
    approved: boolean | null;
    reason: string | null;
    muted: boolean;
    created_on: string;
    responded_to: string | null;
    history: MembershipRequestHistoryItem[];
};