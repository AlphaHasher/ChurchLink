import api from '@/api/api';
import { ChurchBulletin, BulletinFilter, ServiceBulletin, BulletinFeedOut } from '@/shared/types/ChurchBulletin';

/**
 * Safely coerce unknown value to Date, with fallback to epoch (Jan 1, 1970)
 */
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

	console.warn('[bulletinsApi] Invalid date value, using epoch:', value);
	return new Date(0);
};

/**
 * Safely extract string value with type guard
 */
const safeString = (value: unknown, fallback: string): string => {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}
	return fallback;
};

/**
 * Type guard for service bulletin data from API
 */
const isServiceData = (item: unknown): item is Record<string, unknown> => {
	return (
		typeof item === 'object' &&
		item !== null &&
		'id' in item &&
		'title' in item &&
		'day_of_week' in item &&
		'time_of_day' in item
	);
};

/**
 * Type guard for bulletin data from API
 */
const isBulletinData = (item: unknown): item is Record<string, unknown> => {
	return (
		typeof item === 'object' &&
		item !== null &&
		'id' in item &&
		'headline' in item &&
		'publish_date' in item
	);
};

/**
 * Coerce API service data to ServiceBulletin with type safety
 */
const coerceService = (item: unknown): ServiceBulletin | null => {
	if (!isServiceData(item)) {
		console.error('[bulletinsApi] Invalid service data structure:', item);
		return null;
	}

	return {
		...item,
		day_of_week: safeString(item['day_of_week'], 'Sunday'),
		time_of_day: safeString(item['time_of_day'], '10:00'),
		display_week: coerceDate(item['display_week']),
		visibility_mode: (item['visibility_mode'] === 'always' || item['visibility_mode'] === 'specific_weeks')
			? item['visibility_mode']
			: 'always',
		created_at: item['created_at'] ? coerceDate(item['created_at']) : undefined,
		updated_at: item['updated_at'] ? coerceDate(item['updated_at']) : undefined
	} as ServiceBulletin;
};

/**
 * Coerce API bulletin data to ChurchBulletin with type safety
 */
const coerceBulletin = (item: unknown): ChurchBulletin | null => {
	if (!isBulletinData(item)) {
		console.error('[bulletinsApi] Invalid bulletin data structure:', item);
		return null;
	}

	return {
		...item,
		publish_date: coerceDate(item['publish_date']),
		expire_at: item['expire_at'] ? coerceDate(item['expire_at']) : undefined,
		created_at: item['created_at'] ? coerceDate(item['created_at']) : undefined,
		updated_at: item['updated_at'] ? coerceDate(item['updated_at']) : undefined
	} as ChurchBulletin;
};

export interface ServerWeekInfo {
	current_date: string;
	week_start: string;
	week_end: string;
	week_label: string;
	timezone: string;
}

/**
 * Fetch current week info from server (server-localized)
 */
export const fetchCurrentWeek = async (): Promise<ServerWeekInfo> => {
	try {
		const res = await api.get('/v1/bulletins/current_week');
		return res.data as ServerWeekInfo;
	} catch (err) {
		console.error('[Current Week] Failed to fetch server week info:', err);
		// Fallback to client-side calculation if server endpoint fails
		const today = new Date();
		const dayOfWeek = today.getDay();
		const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		const monday = new Date(today);
		monday.setDate(today.getDate() + daysToMonday);
		monday.setHours(0, 0, 0, 0);
		
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		sunday.setHours(23, 59, 59, 999);
		
		return {
			current_date: today.toISOString(),
			week_start: monday.toISOString(),
			week_end: sunday.toISOString(),
			week_label: `For the week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
			timezone: 'client-local'
		};
	}
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

		// Validate response structure
		if (!data || typeof data !== 'object') {
			throw new Error('Invalid response format: expected object');
		}

		// Extract and validate services and bulletins arrays
		const servicesRaw = Array.isArray(data.services) ? data.services : [];
		const bulletinsRaw = Array.isArray(data.bulletins) ? data.bulletins : [];
		
		// Coerce and filter out invalid entries
		const services = servicesRaw
			.map(coerceService)
			.filter((s): s is ServiceBulletin => s !== null);
		
		const bulletins = bulletinsRaw
			.map(coerceBulletin)
			.filter((b): b is ChurchBulletin => b !== null);
		
		console.log(`[Combined Feed] Received ${services.length} services, ${bulletins.length} bulletins`);

		return { services, bulletins };
	} catch (err) {
		console.error(`[Combined Feed] Failed to fetch at ${new Date().toISOString()}:`, err);
		throw err; // Re-throw to let caller handle error
	}
};

/**
 * Fetch only bulletins (without services)
 */
export const fetchBulletins = async (filters?: BulletinFilter): Promise<ChurchBulletin[]> => {
	try {
		const params = { ...(filters || {}) };
		const res = await api.get('/v1/bulletins/', { params });
		
		// Handle both array response and BulletinFeedOut structure
		const data = res.data;
		let bulletinsRaw: unknown[] = [];
		
		if (Array.isArray(data)) {
			bulletinsRaw = data;
		} else if (data && typeof data === 'object' && 'bulletins' in data) {
			bulletinsRaw = Array.isArray(data.bulletins) ? data.bulletins : [];
		}

		return bulletinsRaw
			.map(coerceBulletin)
			.filter((b): b is ChurchBulletin => b !== null);
	} catch (err) {
		console.error('Failed to fetch bulletins:', err);
		throw err;
	}
};

export const fetchBulletinById = async (id: string): Promise<ChurchBulletin | null> => {
	try {
		const res = await api.get(`/v1/bulletins/${id}`);
		return coerceBulletin(res.data);
	} catch (err) {
		console.error('Failed to fetch bulletin:', err);
		throw err;
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
		return dataArr
			.map(coerceService)
			.filter((s): s is ServiceBulletin => s !== null);
	} catch (err) {
		console.error('Failed to fetch services:', err);
		throw err;
	}
};

export const fetchServiceById = async (id: string): Promise<ServiceBulletin | null> => {
	try {
		const res = await api.get(`/v1/bulletins/services/${id}`);
		return coerceService(res.data);
	} catch (err) {
		console.error('Failed to fetch service:', err);
		throw err;
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

export const reorderBulletins = async (bulletinIds: string[]) => {
	try {
		await api.patch('/v1/bulletins/reorder', { bulletin_ids: bulletinIds });
	} catch (err) {
		console.error('Failed to reorder bulletins:', err);
		throw err;
	}
};
