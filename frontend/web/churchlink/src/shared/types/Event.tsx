export type EventRecurrence = "never" | "weekly" | "monthly" | "yearly" | "daily"

export type EventGenderOption = "all" | "male" | "female"

export type EventPaymentOption = "paypal" | "door"

export type RegistrationDetails = {
    self_registered: boolean;
    family_registered: string[];

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
    location_url?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
    refund_policy?: string | null;
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
    location_url?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
    refund_policy?: string | null;
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
    updated_on: string;
    overrides_date_updated_on: string;

} & AdminPanelEvent;

export type AdminEventInstanceOverrides = {
    localizations?: Map<string, EventLocalization> | null;
    date?: string | null;
    hidden?: boolean | null;
    registration_allowed?: boolean | null;
    registration_opens?: string | null;
    registration_deadline?: string | null;
    members_only?: boolean | null;
    rsvp_required?: boolean | null;
    max_spots?: number | null;
    price?: number | null;
    member_price?: number | null;
    min_age?: number | null;
    max_age?: number | null;
    gender?: EventGenderOption | null;
    location_url?: string | null;
    image_id?: string | null;
    payment_options?: EventPaymentOption[] | null;
    refund_policy?: string | null;
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

// Paged results for instances
export type AdminEventInstancePagedResults = {
    items: AdminEventInstance[]; // concrete instances, assembled + overrides applied
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
    ministries: string[];
    members_only: boolean;
    rsvp_required: boolean;
    max_spots?: number | null;
    price: number;
    member_price?: number | null;
    min_age?: number | null;
    max_age?: number | null;
    gender: EventGenderOption;
    location_url?: string | null;
    image_id: string;
    payment_options: EventPaymentOption[];
    refund_policy?: string | null;
    updated_on: string;
    overrides_date_updated_on: string;

    default_title: string;
    default_description: string;
    default_location_info: string;
    default_localization: string;


    has_registrations: boolean;
    event_registrations: RegistrationDetails | null;
    is_favorited: boolean;
};

export type UserEventResults = {
    items: UserFacingEvent[];
    next_cursor: EventsCursor | null;
};


