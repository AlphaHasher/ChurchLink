import { Ministry } from "./Ministry";

// THIS FILE CONTAINS A GRAND COLLECTION OF TYPES RELATED TO EVENTS.

export type EventRecurrence = "never" | "weekly" | "monthly" | "yearly" | "daily"

export type EventGenderOption = "all" | "male" | "female"

export type EventPaymentOption = "paypal" | "door"

export type EventPaymentType = "free" | "paypal" | "door"

export type PaymentDetails = {
    payment_type: EventPaymentType;
    price: number;
    payment_complete: boolean;
    discount_code_id: string | null;
    automatic_refund_eligibility: boolean;
    transaction_id: string | null;
    line_id: string | null;
}

export type RegistrationDetails = {
    self_registered: boolean;
    family_registered: string[];
    self_payment_details: PaymentDetails | null;
    family_payment_details: Record<string, PaymentDetails>;
};

export type EventLocalization = {
    title: string;
    description: string;
    location_info: string;
}

export type AdminPanelEvent = {
    id: string;
    localizations: Map<string, EventLocalization>;
    // Gets from backend as ISO string so it's much simpler just to use as ISO string
    date: string;
    recurring: EventRecurrence;
    max_published: number;
    currently_publishing: boolean;
    hidden: boolean;
    registration_allowed: boolean;
    // Also optional ISO strings
    registration_opens?: string | null;
    registration_deadline?: string | null;
    automatic_refund_deadline?: string | null;
    ministries: string[];
    members_only: boolean;
    rsvp_required: boolean;
    max_spots?: number | null;
    price: number;
    member_price?: number | null;
    discount_codes: string[];
    min_age?: number | null;
    max_age?: number | null;
    gender: EventGenderOption;
    location_address?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
    // Date last updated on, ISO string
    updated_on: string;
};

export type ReadAdminPanelEvent = {
    default_title: string;
    default_description: string;
    default_location_info: string;
    default_localization: string;
} & AdminPanelEvent;

export type AdminEventSearchParams = {
    page: number;
    limit: number;
    query?: string | null;
    ministries?: string[] | null;
    hidden?: boolean | null;
    members_only?: boolean | null;
    rsvp_required?: boolean | null;
    registration_allowed: boolean | null;
    min_age?: number | null;
    max_age?: number | null;
    gender?: EventGenderOption | null;
    preferred_lang?: string | null;
    sort_by_date_asc?: boolean | null;
};

export type EventPagedResults = {
    items: ReadAdminPanelEvent[];
    page: number;
    limit: number;
    total: number;
    pages: number;
};

export type EventUpdate = {
    localizations: Map<string, EventLocalization>;
    date: string;
    recurring: EventRecurrence;
    max_published: number;
    currently_publishing: boolean;
    hidden: boolean;
    registration_allowed: boolean;
    registration_opens?: string | null;
    registration_deadline?: string | null;
    automatic_refund_deadline?: string | null;
    ministries: string[];
    members_only: boolean;
    rsvp_required: boolean;
    max_spots?: number | null;
    price: number;
    member_price?: number | null;
    discount_codes: string[];
    min_age?: number | null;
    max_age?: number | null;
    gender: EventGenderOption;
    location_address?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
};

export type AdminEventInstance = {
    event_id: string;
    overrides_tracker: boolean[];
    series_index: number;
    seats_filled: number;
    registration_details: Record<string, RegistrationDetails>;
    default_title: string;
    default_description: string;
    default_location_info: string;
    default_localization: string;
    target_date: string;
    overrides_date_updated_on: string;
    event_date: string;

} & AdminPanelEvent;

export type AdminEventInstanceOverrides = {
    localizations?: Map<string, EventLocalization> | null;
    date?: string | null;
    hidden?: boolean | null;
    registration_allowed?: boolean | null;
    registration_opens?: string | null;
    registration_deadline?: string | null;
    automatic_refund_deadline?: string | null;
    members_only?: boolean | null;
    rsvp_required?: boolean | null;
    max_spots?: number | null;
    price?: number | null;
    member_price?: number | null;
    min_age?: number | null;
    max_age?: number | null;
    gender?: EventGenderOption | null;
    location_address?: string | null;
    image_id?: string | null;
    payment_options?: EventPaymentOption[] | null;
}

export type AdminEventInstanceSearchStatus = "all" | "upcoming" | "passed";

export type AdminEventInstanceSearchParams = {
    event_id: string;
    page: number;
    limit: number;
    status?: "all" | "upcoming" | "passed" | null;
    sort_by_series_index_asc?: boolean | null;
    preferred_lang?: string | null;
};

export type AdminEventInstancePagedResults = {
    items: AdminEventInstance[];
    page: number;
    limit: number;
    total: number;
    pages: number;
};

export type EventsCursor = {
    scheduled_date: string; // ISO8601 of the last item returned
    id: string;             // stringified ObjectId of the last item returned
};


export type UserEventSearchParams = {
    limit: number;
    min_age?: number | null;
    max_age?: number | null;
    gender?: EventGenderOption | "male_only" | "female_only" | null;
    ministries?: string[] | null;
    unique_only?: boolean | null;
    preferred_lang?: string | null;
    cursor_scheduled_date?: string | null;
    cursor_id?: string | null;
    favorites_only?: boolean | null;
    members_only_only?: boolean | null;
    max_price?: number | null;
};


export type UserFacingEvent = {
    id: string;
    event_id: string;
    series_index: number;
    date: string;
    seats_filled: number;
    localizations: Map<string, EventLocalization>;
    recurring: EventRecurrence;
    registration_allowed: boolean;
    hidden: boolean;
    registration_opens?: string | null;
    registration_deadline?: string | null;
    automatic_refund_deadline?: string | null;
    ministries: string[];
    members_only: boolean;
    rsvp_required: boolean;
    max_spots?: number | null;
    price: number;
    member_price?: number | null;
    min_age?: number | null;
    max_age?: number | null;
    gender: EventGenderOption;
    location_address?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
    updated_on: string;
    overrides_date_updated_on: string;

    default_title: string;
    default_description: string;
    default_location_info: string;
    default_localization: string;

    event_date: string;


    has_registrations: boolean;
    event_registrations: RegistrationDetails | null;
    is_favorited: boolean;
};

export type UserEventResults = {
    items: UserFacingEvent[];
    next_cursor: EventsCursor | null;
};

export type SisterInstanceIdentifier = {
    id: string;
    date: string;
    updated_on: string;
    event_date: string;
};

export type EventDetailsResponse = {
    success: boolean;
    msg: string;
    event_details: UserFacingEvent | null;
    sister_details: SisterInstanceIdentifier[];
    ministries: Ministry[];
};

export type ChangeEventRegistration = {
    event_instance_id: string;
    self_registered: boolean | null;
    family_members_registering: string[];
    family_members_unregistering: string[];
    payment_type: EventPaymentType;
    discount_code_id: string | null;
}

export type RegistrationChangeResponse = {
    success: boolean;
    msg?: string;
    seats_filled?: number;
    registration_details?: RegistrationDetails | null;
    change_request?: ChangeEventRegistration | null;
    details_map?: Record<string, string> | null;
};

export type CreatePaidRegistrationResponse = {
    success: boolean;
    msg?: string;
    order_id?: string;
    approve_url?: string;
};

export type MyEventsTypeFilter =
    | "favorites_and_registered"
    | "registered"
    | "registered_not_favorited"
    | "favorites"
    | "favorites_not_registered";

export type MyEventsDateFilter = "upcoming" | "history" | "all";

export type MyEventsSearchParams = {
    type?: MyEventsTypeFilter | null;
    date?: MyEventsDateFilter | null;
    limit?: number | null;

    preferred_lang?: string | null;

    cursor_scheduled_date?: string | null;
    cursor_id?: string | null;
};

export type MyEventsResults = UserEventResults;


export type DiscountCodeUpdate = {
    name: string;
    description?: string | null;
    code: string;
    is_percent: boolean;
    discount: number;
    max_uses?: number | null;
    active: boolean;
};

export type DiscountCode = DiscountCodeUpdate & {
    id: string;
    usage_history: Record<string, number>;
};

export type DiscountCodeResponse = {
    success: boolean;
    msg?: string;
    code?: DiscountCode | null;
};

export type DiscountCodesListResponse = {
    success: boolean;
    msg?: string;
    codes: DiscountCode[];
};


export type EventDiscountCodesUpdate = {
    event_id: string;
    discount_codes: string[];
};

export type SetEventDiscountCodesResponse = {
    success: boolean;
    msg?: string;
    event?: ReadAdminPanelEvent;
};

export type EventsWithDiscountResponse = {
    success: boolean;
    msg?: string;
    events: ReadAdminPanelEvent[];
    preferred_lang?: string;
};

export type DeleteDiscountCodeResponse = {
    success: boolean;
    msg?: string;
    affected_events?: number;
};


export type DiscountCodeCheckRequest = {
    event_id: string;  // NOTICE: EVENT ID NOT INSTANCE ID!
    discount_code: string; // raw user input; server normalizes (trim + uppercase)
};

export type DiscountCodeCheckResponse = {
    success: boolean;
    msg?: string;
    id?: string | null;
    is_percent?: boolean;
    discount?: number;
    uses_left?: number | null;
};

export type PersonDetails = {
    first_name: string | null;
    last_name: string | null;
    DOB: string | null;
    gender: string | null;
};

export type PersonDict = { SELF: PersonDetails } & Record<string, PersonDetails>;

export type AdminRegistrationDetailsByUserResponse = {
    success: boolean;
    msg?: string;
    event_instance?: AdminEventInstance | null;
    person_dict?: PersonDict | null;
};
