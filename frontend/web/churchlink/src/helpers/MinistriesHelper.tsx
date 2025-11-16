import api from "../api/api"
import { Ministry } from "@/shared/types/Ministry"

// Fetch canonical ministries list
export const fetchMinistries = async (): Promise<Ministry[]> => {
    try {
        const res = await api.get("/v1/ministries");
        return res.data?.map((m: any) => m) || [];
    } catch (err) {
        console.error("Failed to fetch ministries:", err);
        return [];
    }
};

export const fetchMinistriesAsStringArray = async (): Promise<string[]> => {
    try {
        const res = await api.get("/v1/ministries");
        const arr = Array.isArray(res.data) ? res.data : [];
        return arr
            .map((m: any) => (m?.name ?? "").toString().trim())
            .filter((s: string) => s.length > 0);
    } catch (err) {
        console.error("Failed to fetch ministries:", err);
        return [];
    }
};

// Create an id -> name lookup from a ministries array
export const buildMinistryNameMap = (ministries: Ministry[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const m of ministries || []) {
        if (!m || !m.id) continue;
        const name = (m.name ?? "").toString().trim();
        if (name) map[m.id] = name;
    }
    return map;
};