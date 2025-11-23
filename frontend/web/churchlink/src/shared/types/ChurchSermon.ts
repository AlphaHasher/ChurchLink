export type ChurchSermon = {
    id: string;
    title: string;
    description: string;
    speaker: string;
    ministry: string[];  // Array of ObjectId strings
    ministry_refs?: Array<{id: string; name: string}>;  // Hydrated ministry objects from backend
    youtube_url: string;
    date_posted: Date;
    published: boolean;
    roles?: string[];
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
    ministry_id?: string;  // ObjectId string for filtering
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
    speaker: 'Speaker',
    ministry: 'Ministry',
    youtube_url: 'YouTube URL',
    date_posted: 'Posted Date',
    published: 'Published',
};
