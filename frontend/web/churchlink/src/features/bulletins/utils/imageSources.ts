import { ChurchBulletin } from "@/shared/types/ChurchBulletin";

type ImageSourceInput = {
    imageId?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
};

const sanitize = (value?: string | null): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const isLikelyObjectId = (value: string): boolean => /^[a-fA-F0-9]{24}$/.test(value);

const buildRelativeAssetUrl = (id: string, thumbnail: boolean): string => {
    const encoded = encodeURIComponent(id);
    const suffix = thumbnail ? "?thumbnail=true" : "";
    return `/api/v1/assets/public/id/${encoded}${suffix}`;
};

const buildHostAssetUrl = (id: string, thumbnail: boolean): string | null => {
    const host = sanitize(import.meta.env.VITE_API_HOST ?? null);
    if (!host) return null;

    try {
        const normalized = host.endsWith("/") ? host : `${host}/`;
        const path = `api/v1/assets/public/id/${encodeURIComponent(id)}${thumbnail ? "?thumbnail=true" : ""}`;
        return new URL(path, normalized).toString();
    } catch (error) {
        console.warn("[BulletinImageSources] Failed to build host asset URL", error);
        return null;
    }
};

const appendCandidate = (candidate: string | null, seen: Set<string>, output: string[]) => {
    const value = sanitize(candidate);
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    output.push(value);
};

export const buildBulletinImageSources = ({
    imageId,
    imageUrl,
    thumbnailUrl,
}: ImageSourceInput): string[] => {
    const candidates: string[] = [];
    const seen = new Set<string>();

    appendCandidate(thumbnailUrl, seen, candidates);
    appendCandidate(imageUrl, seen, candidates);

    const sanitizedId = sanitize(imageId);
    if (sanitizedId && isLikelyObjectId(sanitizedId)) {
        appendCandidate(buildHostAssetUrl(sanitizedId, true), seen, candidates);
        appendCandidate(buildHostAssetUrl(sanitizedId, false), seen, candidates);
        appendCandidate(buildRelativeAssetUrl(sanitizedId, true), seen, candidates);
        appendCandidate(buildRelativeAssetUrl(sanitizedId, false), seen, candidates);
    }

    return candidates;
};

export const hasBulletinImage = (input: ImageSourceInput): boolean => {
    return buildBulletinImageSources(input).length > 0;
};

export const buildBulletinImageSourcesFromBulletin = (bulletin: ChurchBulletin): string[] => {
    return buildBulletinImageSources({
        imageId: bulletin.image_id,
        imageUrl: bulletin.image_url,
        thumbnailUrl: bulletin.thumbnail_url,
    });
};
