import api from '@/api/api';
import { MyEventsResponse } from '@/features/events/types/myEvents';

export const myEventsApi = {
	// Get user's events (basic references only by default)
	getMyEvents: async (params?: {
		include_family?: boolean;
	}): Promise<MyEventsResponse> => {
		const response = await api.get('/v1/event-people/my-events', { params });
		return response.data;
	},

	// Get expanded events with full event details
	getMyEventsExpanded: async (params?: {
		include_family?: boolean;
	}): Promise<MyEventsResponse> => {
		const response = await api.get('/v1/event-people/my-events', {
			params: { ...params, expand: true }
		});
		return response.data;
	},

	// Cancel RSVP (personal or family member)
	cancelRSVP: async (eventId: string, personId?: string) => {
		const endpoint = personId
			? `/v1/event-people/unregister/${eventId}/family-member/${personId}`
			: `/v1/event-people/unregister/${eventId}`;

		const response = await api.delete(endpoint);
		return response.data;
	},

	// Get event details (reuse existing events API)
	getEventDetails: async (eventId: string) => {
		const response = await api.get(`/v1/events/${eventId}`);
		return response.data;
	}
};
