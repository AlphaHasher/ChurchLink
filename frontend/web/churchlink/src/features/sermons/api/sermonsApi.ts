import api from '@/api/api';
import { ChurchSermon, SermonFilter } from '@/shared/types/ChurchSermon';

const coerceDate = (value: unknown): Date => {
	if (value instanceof Date) {
		return value;
	}

	if (typeof value === 'string' || typeof value === 'number') {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return new Date(0);
};

export const fetchSermons = async (filters?: SermonFilter): Promise<ChurchSermon[]> => {
	try {
		const params = { ...(filters || {}) };
		const res = await api.get('/v1/sermons/', { params });
		const dataRaw = res.data as unknown;
		const dataArr = Array.isArray(dataRaw) ? dataRaw : [];

		return dataArr.map((entry) => {
			const item = entry as Record<string, unknown>;
			return {
				...item,
				date_posted: coerceDate(item['date_posted'])
			} as ChurchSermon;
		});
	} catch (err) {
		console.error('Failed to fetch sermons:', err);
		return [];
	}
};

export const fetchSermonById = async (id: string): Promise<ChurchSermon | null> => {
	try {
		const res = await api.get(`/v1/sermons/${id}`);
		const obj = res.data as Record<string, unknown>;

		return {
			...obj,
			date_posted: coerceDate(obj['date_posted'])
		} as ChurchSermon;
	} catch (err) {
		console.error('Failed to fetch sermon:', err);
		return null;
	}
};

export const createSermon = async (payload: unknown) => {
	try {
		await api.post('/v1/sermons/', payload);
	} catch (err) {
		console.error('Failed to create sermon:', err);
		throw err;
	}
};

export const updateSermon = async (id: string, payload: unknown) => {
	try {
		await api.put(`/v1/sermons/${id}`, payload);
	} catch (err) {
		console.error('Failed to update sermon:', err);
		throw err;
	}
};

export const deleteSermon = async (id: string) => {
	try {
		await api.delete(`/v1/sermons/${id}`);
	} catch (err) {
		console.error('Failed to delete sermon:', err);
		throw err;
	}
};

export const togglePublish = async (id: string, published: boolean) => {
	try {
		await api.patch(`/v1/sermons/${id}/publish`, { published });
	} catch (err) {
		console.error('Failed to toggle publish:', err);
		throw err;
	}
};

export const favoriteSermon = async (id: string) => {
	try {
		await api.post(`/v1/sermons/${id}/favorite`);
	} catch (err) {
		console.error('Failed to favorite sermon:', err);
		throw err;
	}
};

export const unfavoriteSermon = async (id: string) => {
	try {
		await api.delete(`/v1/sermons/${id}/favorite`);
	} catch (err) {
		console.error('Failed to unfavorite sermon:', err);
		throw err;
	}
};
