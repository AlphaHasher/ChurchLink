export type ChurchSermon = {
    id: string;
    title: string;
    description: string;
    speaker: string;
    ministry: string[];
    youtube_url: string;
    date_posted: Date;
    published: boolean;
    roles?: string[];
    ru_title?: string;
    ru_description?: string;
    ru_speaker?: string;
    thumbnail_url?: string;
    tags?: string[];
    duration_seconds?: number;
    summary?: string;
    created_at?: Date;
    updated_at?: Date;
    is_favorited?: boolean;
};

export type SermonFilter = {
    skip?: number;
    limit?: number;
    ministry?: string;
    speaker?: string;
    tags?: string[];
    date_after?: string;
    date_before?: string;
    published?: boolean;
    query?: string;
}

export const sermonLabels: Record<string, string> = {
    id: 'ID',
    title: 'Title',
    description: 'Description',
    ru_title: 'Title (RU)',
    ru_description: 'Description (RU)',
    speaker: 'Speaker',
    ru_speaker: 'Speaker (RU)',
    ministry: 'Ministry',
    youtube_url: 'YouTube URL',
    date_posted: 'Posted Date',
    published: 'Published',
};
