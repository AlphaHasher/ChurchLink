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
}

// Create an id -> name lookup from a ministries array
export const buildMinistryNameMap = (ministries: Ministry[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const m of ministries || []) {
        if (!m || !m.id) continue;
        // prefer explicit name, fall back to normalized_name if needed
        const name = (m.name ?? m.normalized_name ?? "").toString().trim();
        if (name) map[m.id] = name;
    }
    return map;
};