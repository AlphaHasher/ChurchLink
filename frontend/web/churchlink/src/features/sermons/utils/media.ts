import { ChurchSermon } from '@/shared/types/ChurchSermon';

export const extractYoutubeId = (url?: string): string | null => {
    if (!url) return null;

    try {
        const parsed = new URL(url.trim());
        if (parsed.hostname.includes('youtu.be')) {
            const id = parsed.pathname.replace('/', '').trim();
            return id || null;
        }

        if (parsed.hostname.includes('youtube.com')) {
            const params = parsed.searchParams.get('v');
            if (params) {
                return params.trim();
            }

            const pathSegments = parsed.pathname.split('/').filter(Boolean);
            const embedIndex = pathSegments.indexOf('embed');
            if (embedIndex !== -1 && pathSegments[embedIndex + 1]) {
                return pathSegments[embedIndex + 1];
            }
        }
    } catch {
        // fall back to simple heuristics below
    }

    const compact = url.replace(/^[^=]*=/, '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(compact)) {
        return compact;
    }

    return null;
};

export const buildThumbnailUrl = (sermon: Pick<ChurchSermon, 'thumbnail_url' | 'youtube_url'>): string | null => {
    if (sermon.thumbnail_url) {
        return sermon.thumbnail_url;
    }

    const videoId = extractYoutubeId(sermon.youtube_url);
    if (!videoId) {
        return null;
    }

    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
};

const parseIsoDuration = (value: string): number | null => {
    const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (!match) {
        return null;
    }

    const [, days, hours, minutes, seconds] = match;
    const totalSeconds =
        (Number(days ?? 0) * 86400) +
        (Number(hours ?? 0) * 3600) +
        (Number(minutes ?? 0) * 60) +
        Number(seconds ?? 0);

    return totalSeconds > 0 ? totalSeconds : null;
};

const parseClockTime = (value: string): number | null => {
    const clockMatch = value.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
    if (!clockMatch) {
        return null;
    }

    const [, hOrM, mins, secs = '0'] = clockMatch;
    const hoursCandidate = value.toLowerCase().includes('hour') || Number(hOrM) > 12;

    if (clockMatch[3]) {
        // h:mm:ss format assumed
        return Number(hOrM) * 3600 + Number(mins) * 60 + Number(secs);
    }

    if (hoursCandidate) {
        return Number(hOrM) * 3600 + Number(mins) * 60;
    }

    return Number(hOrM) * 60 + Number(mins);
};

const parseDurationFromText = (value?: string): number | null => {
    if (!value) {
        return null;
    }

    const durationLabelMatch = value.match(/(?:duration|length)\s*[:-]?\s*(.*)/i);
    if (durationLabelMatch) {
        const parsed = parseClockTime(durationLabelMatch[1]);
        if (parsed) {
            return parsed;
        }
    }

    const hoursMinutes = value.match(/(\d+)\s*(?:hours?|hrs?|h)\s*(\d+)?\s*(?:minutes?|mins?|m)?/i);
    if (hoursMinutes) {
        const hours = Number(hoursMinutes[1]);
        const minutes = Number(hoursMinutes[2] ?? 0);
        const totalSeconds = hours * 3600 + minutes * 60;
        if (totalSeconds > 0) {
            return totalSeconds;
        }
    }

    const minutesOnly = value.match(/(\d+)\s*(?:minutes?|mins?|min\.)\b/i);
    if (minutesOnly) {
        const totalSeconds = Number(minutesOnly[1]) * 60;
        if (totalSeconds > 0) {
            return totalSeconds;
        }
    }

    const clock = parseClockTime(value);
    if (clock) {
        return clock;
    }

    return null;
};

export const coerceDurationSeconds = (value: unknown): number | null => {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        if (/^PT/i.test(trimmed)) {
            return parseIsoDuration(trimmed);
        }

        if (/^\d+$/.test(trimmed)) {
            const asNumber = Number(trimmed);
            return asNumber > 0 ? asNumber : null;
        }

        const fromClock = parseClockTime(trimmed);
        if (fromClock) {
            return fromClock;
        }
    }

    return null;
};

export const resolveDurationSeconds = (sermon: Pick<ChurchSermon, 'duration_seconds' | 'summary' | 'description'>): number | null => {
    const direct = coerceDurationSeconds(sermon.duration_seconds);
    if (direct) {
        return direct;
    }

    const fromSummary = parseDurationFromText(sermon.summary);
    if (fromSummary) {
        return fromSummary;
    }

    const fromDescription = parseDurationFromText(sermon.description);
    if (fromDescription) {
        return fromDescription;
    }

    return null;
};

export const formatDurationLabel = (seconds: number | null): string | null => {
    if (seconds === null || Number.isNaN(seconds)) {
        return null;
    }

    const totalSeconds = Math.max(0, Math.floor(seconds));
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return null;
    }

    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
