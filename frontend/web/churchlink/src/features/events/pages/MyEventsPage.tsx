import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useMyEvents } from '../hooks/useMyEvents';
import { MyEventCard } from '../components/MyEventCard';
import { EventFiltersComponent } from '../components/EventFilters';
import { EventDetailsModal } from '../components/EventDetailsModal';
import { myEventsApi } from '@/features/events/api/myEventsApi';
import api from '@/api/api';
import { getMyProfileInfo } from '@/helpers/UserHelper';
import { MyEvent, EventFilters, GroupedEvent } from '../types/myEvents';
import { ProfileInfo } from '@/shared/types/ProfileInfo';

export default function MyEventsPage() {
  // State management
  const [filters, setFilters] = useState<EventFilters>({
    showUpcoming: true,
    showPast: true,
    showFamily: true,
    searchTerm: '',
  });
  const [selectedEvent, setSelectedEvent] = useState<MyEvent | null>(null);
  const [, setUserProfile] = useState<ProfileInfo | null>(null);

  // Load user profile for eligibility checking
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await getMyProfileInfo();
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

  // Helper function to convert single event to grouped format
  const createGroupedEvent = (eventRef: MyEvent): GroupedEvent => {
    const eventDate = eventRef.event ? new Date(eventRef.event.date) : new Date();
    return {
      event_id: eventRef.event_id,
      event: eventRef.event,
      registrants: {
        user: eventRef,
        family: []
      },
      isUpcoming: eventDate > new Date(),
      eventDate,
      allRegistrants: [eventRef]
    };
  };

  // Data fetching - use expanded mode to get full event details
  const { events, loading, error, refetch } = useMyEvents({
    include_family: filters.showFamily,
    expanded: true, // Get full event details for display
  });

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    console.log('[MyEventsPage] Raw events from API:', events);
    console.log('[MyEventsPage] Events count before filtering:', events.length);

    // Deduplicate events based on unique key (event_id + person_id combination)
    // This provides a robust safety net against backend data inconsistencies
    const uniqueEventsMap = new Map<string, MyEvent>();

    events.forEach(eventRef => {
      const uniqueKey = eventRef.person_id
        ? `${eventRef.event_id}-${eventRef.person_id}`
        : `${eventRef.event_id}-user`;

      // Keep the most recent occurrence (latest addedOn timestamp)
      if (!uniqueEventsMap.has(uniqueKey)) {
        uniqueEventsMap.set(uniqueKey, eventRef);
      } else {
        const existing = uniqueEventsMap.get(uniqueKey)!;
        const existingDate = new Date(existing.addedOn);
        const currentDate = new Date(eventRef.addedOn);
        
        // Replace with more recent registration
        if (currentDate > existingDate) {
          uniqueEventsMap.set(uniqueKey, eventRef);
        }
      }
    });

    const deduplicatedEvents = Array.from(uniqueEventsMap.values());
    console.log('[MyEventsPage] Deduplicated events:', deduplicatedEvents);

    const filtered = deduplicatedEvents.filter(eventRef => {
      const event = eventRef.event;
      console.log('[MyEventsPage] Filtering event:', { eventRef, event });

      if (!event) {
        console.log('[MyEventsPage] Skipping event - no event details');
        return false; // Skip if no event details loaded
      }

      const eventDate = new Date(event.date);
      const now = new Date();
      const isUpcoming = eventDate > now;

      // Date filtering
      if (!filters.showUpcoming && isUpcoming) {
        console.log('[MyEventsPage] Skipping event - upcoming filtered out');
        return false;
      }
      if (!filters.showPast && !isUpcoming) {
        console.log('[MyEventsPage] Skipping event - past filtered out');
        return false;
      }

      // Family filtering
      if (!filters.showFamily && eventRef.person_id) {
        console.log('[MyEventsPage] Skipping event - family filtered out');
        return false;
      }

      // Search filtering
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matches = (
          event.name.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower) ||
          event.location.toLowerCase().includes(searchLower) ||
          event.ministry.some((m: string) => m.toLowerCase().includes(searchLower))
        );
        if (!matches) {
          console.log('[MyEventsPage] Skipping event - search filter no match');
          return false;
        }
      }

      console.log('[MyEventsPage] Event passed all filters');
      return true;
    });

    console.log('[MyEventsPage] Filtered events:', filtered);
    console.log('[MyEventsPage] Filtered events count:', filtered.length);
    return filtered;
  }, [events, filters]);

  // Event handlers
  const handleEventClick = (event: MyEvent) => {
    setSelectedEvent(event);
  };

  const handleCancelRSVP = async (eventRef: MyEvent) => {
    try {
      await myEventsApi.cancelRSVP(eventRef.event_id, eventRef.person_id);
      refetch(); // Refresh the events list
      
      // Show success notification
      const personName = eventRef.display_name ? ` for ${eventRef.display_name}` : '';
      toast.success(`RSVP cancelled successfully${personName}`);
      
    } catch (error: any) {
      console.error('Failed to cancel RSVP:', error);
      
      // Show error notification with more details
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to cancel RSVP';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  // Handle refund request
  const handleRefundRequest = async (eventRef: MyEvent): Promise<void> => {
    try {
      // Show confirmation dialog with refund policy
      const refundPolicy = eventRef.event?.refund_policy || "Standard refund policy applies.";
      const displayName = eventRef.display_name || 'your registration';
      const confirmMessage = `Request refund for ${displayName}?\n\nRefund Policy: ${refundPolicy}\n\nThis will:\n• Submit a refund request to administrators\n• Keep the registration active until refund is processed\n• Send you email updates on refund status`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }

      // Submit refund request
      const payload = {
        event_id: eventRef.event_id,
        person_id: eventRef.person_id,
        display_name: displayName,
        reason: "User requested refund via My Events page"
      };

      const response = await api.post(`/v1/events/${eventRef.event_id}/refund/request`, payload);
      
      if (response.data?.success) {
        toast.success(`Refund request submitted successfully for ${displayName}. You will receive email updates on the refund status.`);
        
        // Refresh the events list to show updated status
        refetch();
      } else {
        throw new Error(response.data?.message || "Failed to submit refund request");
      }
    } catch (error: any) {
      console.error("Refund request failed:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to submit refund request";
      toast.error(`Refund request failed: ${errorMessage}`);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Events</h1>
          <p className="text-gray-600">Manage your event registrations</p>
        </div>
        <p>Loading events...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Events</h1>
          <p className="text-gray-600">Manage your event registrations</p>
        </div>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Events</h1>
        <p className="text-gray-600">Manage your event registrations</p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <EventFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {events.length === 0
              ? "You haven't registered for any events yet."
              : "No events match your current filters."
            }
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((eventRef, index) => {
            // Create unique key combining event_id and person_id to handle cases where
            // both user and family member are registered for the same event
            const uniqueKey = eventRef.person_id
              ? `${eventRef.event_id}-${eventRef.person_id}`
              : `${eventRef.event_id}-user`;

            return (
              <motion.div
                key={uniqueKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                data-testid="event-card"
              >
                <MyEventCard
                  groupedEvent={createGroupedEvent(eventRef)}
                  onClick={() => handleEventClick(eventRef)}
                // onCancelRSVP={async () => await handleCancelRSVP(eventRef)}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          eventRef={selectedEvent}
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          onCancelRSVP={handleCancelRSVP}
          onRefundRequest={handleRefundRequest}
        />
      )}
    </div>
  );
}