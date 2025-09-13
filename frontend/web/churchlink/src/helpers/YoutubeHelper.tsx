import api from "../api/api";

// Fetches the StreamIDs of the current lives from backend
export const getStreamIDs = async (): Promise<string[]> => {
    try {
        const res = await api.get("/v1/youtube/livestreams");
        return (res.data?.stream_ids as string[]) ?? [];
    } catch (err) {
        console.error("Failed to fetch Youtube Stream Ids!:", err);
        return [];
    }
};


// Converts stream ID to embed url
export const getEmbedURLFromStreamID = (id: string): string => {
    const safeId = encodeURIComponent(id);
    return `https://www.youtube-nocookie.com/embed/${safeId}?rel=0&modestbranding=1&playsinline=1`;
};

// Converts stream ID to a clickable youtube live
export const getStreamURLFromStreamID = (id: string): string => {
    const safeId = encodeURIComponent(id);
    return `https://www.youtube.com/watch?v=${safeId}`;
};