import api from "../api/api";

export const getStreamIDs = async () => {
    try {
        const res = await api.get("/v1/youtube/livestreams");
        return res.data.stream_ids;
    } catch (err) {
        console.error("Failed to fetch Youtube Stream Ids!:", err);
        return [];
    }
}

export const getLivestreamUrls = async () => {
    try {
        const stream_ids = await getStreamIDs();
        return stream_ids
    }
    catch (err) {
        return [];
    }
}