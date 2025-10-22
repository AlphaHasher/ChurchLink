import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMyEvents } from '../hooks/useMyEvents';
import { MyEventCard } from './MyEventCard';
import { EventFiltersComponent } from './EventFilters';
import { EventDetailsModal } from './EventDetailsModal';
import { myEventsApi } from '@/features/events/api/myEventsApi';
import { getMyProfileInfo } from '@/helpers/UserHelper';
import { MyEvent, EventFilters, GroupedEvent, EventWithGroupedData } from '../types/myEvents';
import { ProfileInfo } from '@/shared/types/ProfileInfo';

export function MyEventsSection() {
  // State management
  const [filters, setFilters] = useState<EventFilters>({
    showUpcoming: true,
    showPast: true,
    showFamily: true,
    searchTerm: '',
  });
  const [selectedEvent, setSelectedEvent] = useState<EventWithGroupedData | null>(null);
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

  // Memoize the API parameters to prevent infinite re-renders
  const apiParams = useMemo(() => ({
    include_family: filters.showFamily,
    expanded: true, // Get full event details for display
  }), [filters.showFamily]);

  // Data fetching - use expanded mode to get full event details
  const { events, loading, error, refetch } = useMyEvents(apiParams);

  // Group and filter events based on current filters
  const groupedEvents = useMemo(() => {
    // First, deduplicate events based on unique key (event_id + person_id combination)
    const uniqueEventsMap = new Map<string, MyEvent>();

    events.forEach(eventRef => {
      const uniqueKey = eventRef.person_id
        ? `${eventRef.event_id}-${eventRef.person_id}`
        : `${eventRef.event_id}-user`;

      // Keep the first occurrence, ignore duplicates
      if (!uniqueEventsMap.has(uniqueKey)) {
        uniqueEventsMap.set(uniqueKey, eventRef);
      }
    });

    const deduplicatedEvents = Array.from(uniqueEventsMap.values());

    // Group events by event_id
    const eventGroups = new Map<string, GroupedEvent>();

    deduplicatedEvents.forEach(eventRef => {
      const event = eventRef.event;
      if (!event) return; // Skip if no event details loaded

      const eventDate = new Date(event.date);
      const isUpcoming = eventDate > new Date();

      if (!eventGroups.has(eventRef.event_id)) {
        // Create new group for this event
        eventGroups.set(eventRef.event_id, {
          event_id: eventRef.event_id,
          event: event,
          registrants: { family: [] },
          isUpcoming,
          eventDate,
          allRegistrants: []
        });
      }

      const group = eventGroups.get(eventRef.event_id)!;

      // Add registrant to appropriate category
      if (eventRef.person_id) {
        group.registrants.family.push(eventRef);
      } else {
        group.registrants.user = eventRef;
      }

      group.allRegistrants.push(eventRef);
    });

    // Filter groups based on current filters
    return Array.from(eventGroups.values()).filter(group => {
      const event = group.event;

      // Date filtering
      if (!filters.showUpcoming && group.isUpcoming) return false;
      if (!filters.showPast && !group.isUpcoming) return false;

      // Family filtering - if showFamily is false, only show events where user is registered
      if (!filters.showFamily && !group.registrants.user) return false;

      // Search filtering
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          event?.name.toLowerCase().includes(searchLower) ||
          event?.description.toLowerCase().includes(searchLower) ||
          event?.location.toLowerCase().includes(searchLower) ||
          event?.ministry.some((m: string) => m.toLowerCase().includes(searchLower))
        );
      }

      return true;
    });
  }, [events, filters]);

  // Event handlers
  const handleEventClick = (groupedEvent: GroupedEvent) => {
    // For modal, we'll pass the primary registration (user's if available, otherwise first family member)
    const primaryEvent = groupedEvent.registrants.user || groupedEvent.registrants.family[0];
    if (primaryEvent) {
      // Add all registrants info to the event for the modal
      const allRegistrants = [
        ...(groupedEvent.registrants.user ? [groupedEvent.registrants.user] : []),
        ...groupedEvent.registrants.family
      ];

      const eventWithAllRegistrants: EventWithGroupedData = {
        ...primaryEvent,
        groupedEventData: {
          totalRegistrants: allRegistrants.length,
          allRegistrants
        }
      };
      setSelectedEvent(eventWithAllRegistrants);
    }
  };

  const handleCancelRSVP = async (eventRef: MyEvent): Promise<void> => {
    try {
      await myEventsApi.cancelRSVP(eventRef.event_id, eventRef.person_id);
      refetch(); // Refresh the events list
      // TODO: Show success notification
      console.log('RSVP cancelled successfully');
    } catch (error) {
      // TODO: Show error notification
      console.error('Failed to cancel RSVP:', error);
      throw error; // Re-throw so the modal can handle it
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <p>Loading events...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
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
    <div className="space-y-6">
      {/* Filters */}
      <EventFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
      />

      {/* Events Grid */}
      {groupedEvents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {events.length === 0
              ? "You haven't registered for any events yet."
              : "No events match your current filters."
            }
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedEvents.map((groupedEvent, index) => {
            // Create unique key for grouped events
            const uniqueKey = `grouped-${groupedEvent.event_id}`;

            return (
              <motion.div
                key={uniqueKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                data-testid="event-card"
              >
                <MyEventCard
                  groupedEvent={groupedEvent}
                  onClick={() => handleEventClick(groupedEvent)}
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
        />
      )}
    </div>
  );
}