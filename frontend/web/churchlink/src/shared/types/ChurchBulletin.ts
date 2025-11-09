export type AttachmentItem = {
    title: string;
    url: string;
};

// Default pagination limit for bulletins and services
export const DEFAULT_BULLETIN_LIMIT = 100;

export type ChurchBulletin = {
    id: string;
    headline: string;
    body: string;
    publish_date: Date;
    expire_at?: Date;
    published: boolean;
    pinned: boolean;
    order: number;  // Display order for drag-and-drop reordering
    roles?: string[];
    ministries: string[];
    attachments: AttachmentItem[];
    ru_headline?: string;
    ru_body?: string;
    // Image fields for media library integration
    image_id?: string | null;        // 24-char MongoDB ObjectId from media library
    image_url?: string | null;       // Full image URL (computed by backend)
    thumbnail_url?: string | null;   // Thumbnail URL (computed by backend)
    created_at?: Date;
    updated_at?: Date;
};

export type ServiceBulletin = {
    id: string;
    title: string;
    day_of_week: string; // Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
    time_of_day: string; // HH:MM format (24-hour time)
    description?: string;
    timeline_notes?: string; // Markdown-formatted service timeline
    display_week: Date; // Weekly anchor, normalized to Monday 00:00
    order: number; // Display order within the week
    published: boolean;
    visibility_mode: 'always' | 'specific_weeks'; // Controls when service is shown
    ru_title?: string;
    ru_description?: string;
    ru_timeline_notes?: string;
    // Image fields for media library integration
    image_id?: string;        // 24-char MongoDB ObjectId from media library
    image_url?: string;       // Full image URL (computed by backend)
    thumbnail_url?: string;   // Thumbnail URL (computed by backend)
    created_at?: Date;
    updated_at?: Date;
};

export type BulletinFeedOut = {
    services: ServiceBulletin[];
    bulletins: ChurchBulletin[];
};

export type BulletinFilter = {
    skip?: number;
    limit?: number;
    ministry?: string;
    week_start?: string; // Used for services filtering only (services use week-based display_week)
    week_end?: string; // Used for services filtering only (services use week-based display_week)
    published?: boolean;
    pinned_only?: boolean;
    upcoming_only?: boolean; // Used for bulletins: show if publish_date <= now (date-based filtering)
    skip_expiration_filter?: boolean; // Used for admin: show expired bulletins too
    query?: string; // Search query for headline/body
};

export const bulletinLabels: Record<string, string> = {
    id: 'ID',
    headline: 'Headline',
    body: 'Body',
    ru_headline: 'Headline (RU)',
    ru_body: 'Body (RU)',
    publish_date: 'Publish Date',
    expire_at: 'Expiration Date',
    published: 'Published',
    pinned: 'Pinned',
    ministries: 'Ministries',
};
