export type Recurrence = "never" | "weekly" | "monthly" | "yearly"

export type ChurchEvent = {
    id: string;
    name: string;
    ru_name: string;
    description: string;
    ru_description: string;
    date: Date;
    location: string;
    price: number;
    spots: number;
    rsvp: boolean;
    recurring: Recurrence;
    ministry: string[];
    min_age: number;
    max_age: number;
    gender: string;
    image_url: string;
    roles: string[];
    published: boolean;
    // Payment processing fields
    payment_options?: string[];
    refund_policy?: string;
};

export const eventLabels: Record<string, string> = {
    id: "ID",
    name: "Title",
    ru_name: "",
    description: "Description",
    ru_description: "",
    date: "Origin Date",
    location: "Location",
    price: "Event Price",
    spots: "Event Spots",
    rsvp: "RSVP Required?",
    recurring: "Recurring Status",
    ministry: "Associated Ministries",
    min_age: "Minimum Age",
    max_age: "Maximum Age",
    gender: "Genders Allowed",
    image_url: "Image URL",
    roles: 'Roles Allowed to Edit',
    published: 'Published Status',
};

export type FetchEventsParams = {
    query: string;
    skip?: number;
    limit?: number;
    ministry?: string;
    age?: number;
    gender?: "male" | "female" | "all";
    is_free?: boolean;
    sort?: "asc" | "desc";
    sort_by?: "date" | "name" | "location" | "price" | "ministry" | "min_age" | "max_age" | "gender";
};