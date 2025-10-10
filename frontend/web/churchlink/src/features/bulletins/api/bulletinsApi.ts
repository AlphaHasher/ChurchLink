import api from '@/api/api';
import { ChurchBulletin, BulletinFilter, ServiceBulletin, BulletinFeedOut } from '@/shared/types/ChurchBulletin';

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

const coerceService = (item: Record<string, unknown>): ServiceBulletin => {
	return {
		...item,
		day_of_week: (item['day_of_week'] as string) || 'Sunday',
		time_of_day: (item['time_of_day'] as string) || '10:00',
		display_week: coerceDate(item['display_week']),
		visibility_mode: (item['visibility_mode'] as 'always' | 'specific_weeks') || 'always',
		created_at: item['created_at'] ? coerceDate(item['created_at']) : undefined,
		updated_at: item['updated_at'] ? coerceDate(item['updated_at']) : undefined
	} as ServiceBulletin;
};

const coerceBulletin = (item: Record<string, unknown>): ChurchBulletin => {
	return {
		...item,
		publish_date: coerceDate(item['publish_date']),
		expire_at: item['expire_at'] ? coerceDate(item['expire_at']) : undefined,
		created_at: item['created_at'] ? coerceDate(item['created_at']) : undefined,
		updated_at: item['updated_at'] ? coerceDate(item['updated_at']) : undefined
	} as ChurchBulletin;
};

/**
 * Fetch combined feed with services and bulletins
 */
export const fetchCombinedFeed = async (filters?: BulletinFilter): Promise<BulletinFeedOut> => {
	try {
		console.log(`[Combined Feed] Fetching feed at ${new Date().toISOString()}`, filters);
		const params = { ...(filters || {}), include_services: 'true' };
		const res = await api.get('/v1/bulletins/', { params });
		const data = res.data as Record<string, unknown>;

		// Handle both new feed structure {services, bulletins} and legacy array response
		let servicesRaw: unknown[] = [];
		let bulletinsRaw: unknown[] = [];

		if (Array.isArray(data.services) && Array.isArray(data.bulletins)) {
			// New feed structure
			servicesRaw = data.services;
			bulletinsRaw = data.bulletins;
			console.log(`[Combined Feed] Received ${servicesRaw.length} services, ${bulletinsRaw.length} bulletins`);
		} else if (Array.isArray(data)) {
			// Legacy response: array of bulletins only
			console.warn('[Combined Feed] Received legacy array response, no services');
			bulletinsRaw = data as unknown[];
		} else {
			console.warn('[Combined Feed] Unexpected response structure', data);
		}

		return {
			services: servicesRaw.map((s) => coerceService(s as Record<string, unknown>)),
			bulletins: bulletinsRaw.map((b) => coerceBulletin(b as Record<string, unknown>))
		};
	} catch (err) {
		console.error(`[Combined Feed] Failed to fetch at ${new Date().toISOString()}:`, err);
		return { services: [], bulletins: [] };
	}
};

/**
 * Legacy endpoint - fetch only bulletins
 */
export const fetchBulletins = async (filters?: BulletinFilter): Promise<ChurchBulletin[]> => {
	try {
		const params = { ...(filters || {}) };
		const res = await api.get('/v1/bulletins/', { params });
		const dataRaw = res.data as unknown;
		const dataArr = Array.isArray(dataRaw) ? dataRaw : [];

		return dataArr.map((entry) => coerceBulletin(entry as Record<string, unknown>));
	} catch (err) {
		console.error('Failed to fetch bulletins:', err);
		return [];
	}
};

export const fetchBulletinById = async (id: string): Promise<ChurchBulletin | null> => {
	try {
		const res = await api.get(`/v1/bulletins/${id}`);
		return coerceBulletin(res.data as Record<string, unknown>);
	} catch (err) {
		console.error('Failed to fetch bulletin:', err);
		return null;
	}
};

// =====================
// SERVICE CRUD OPERATIONS
// =====================

export const fetchServices = async (filters?: BulletinFilter): Promise<ServiceBulletin[]> => {
	try {
		const params = { ...(filters || {}) };
		const res = await api.get('/v1/bulletins/services/', { params });
		const dataArr = Array.isArray(res.data) ? res.data : [];
		return dataArr.map((s) => coerceService(s as Record<string, unknown>));
	} catch (err) {
		console.error('Failed to fetch services:', err);
		return [];
	}
};

export const fetchServiceById = async (id: string): Promise<ServiceBulletin | null> => {
	try {
		const res = await api.get(`/v1/bulletins/services/${id}`);
		return coerceService(res.data as Record<string, unknown>);
	} catch (err) {
		console.error('Failed to fetch service:', err);
		return null;
	}
};

export const createService = async (payload: unknown) => {
	try {
		await api.post('/v1/bulletins/services/', payload);
	} catch (err) {
		console.error('Failed to create service:', err);
		throw err;
	}
};

export const updateService = async (id: string, payload: unknown) => {
	try {
		await api.put(`/v1/bulletins/services/${id}`, payload);
	} catch (err) {
		console.error('Failed to update service:', err);
		throw err;
	}
};

export const deleteService = async (id: string) => {
	try {
		await api.delete(`/v1/bulletins/services/${id}`);
	} catch (err) {
		console.error('Failed to delete service:', err);
		throw err;
	}
};

export const toggleServicePublish = async (id: string, published: boolean) => {
	try {
		await api.patch(`/v1/bulletins/services/${id}/publish`, { published });
	} catch (err) {
		console.error('Failed to toggle service publish:', err);
		throw err;
	}
};

export const reorderServices = async (serviceIds: string[]) => {
	try {
		await api.patch('/v1/bulletins/services/reorder', { service_ids: serviceIds });
	} catch (err) {
		console.error('Failed to reorder services:', err);
		throw err;
	}
};

// =====================
// BULLETIN CRUD OPERATIONS
// =====================

export const createBulletin = async (payload: unknown) => {
	try {
		await api.post('/v1/bulletins/', payload);
	} catch (err) {
		console.error('Failed to create bulletin:', err);
		throw err;
	}
};

export const updateBulletin = async (id: string, payload: unknown) => {
	try {
		await api.put(`/v1/bulletins/${id}`, payload);
	} catch (err) {
		console.error('Failed to update bulletin:', err);
		throw err;
	}
};

export const deleteBulletin = async (id: string) => {
	try {
		await api.delete(`/v1/bulletins/${id}`);
	} catch (err) {
		console.error('Failed to delete bulletin:', err);
		throw err;
	}
};

export const togglePublish = async (id: string, published: boolean) => {
	try {
		await api.patch(`/v1/bulletins/${id}/publish`, { published });
	} catch (err) {
		console.error('Failed to toggle publish:', err);
		throw err;
	}
};

export const togglePin = async (id: string, pinned: boolean) => {
	try {
		await api.patch(`/v1/bulletins/${id}/pin`, { pinned });
	} catch (err) {
		console.error('Failed to toggle pin:', err);
		throw err;
	}
};
