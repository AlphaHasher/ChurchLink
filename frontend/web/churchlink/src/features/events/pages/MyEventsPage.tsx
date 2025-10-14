import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMyEvents } from '../hooks/useMyEvents';
import { MyEventCard } from '../components/MyEventCard';
import { EventFiltersComponent } from '../components/EventFilters';
import { EventDetailsModal } from '../components/EventDetailsModal';
import { myEventsApi } from '@/features/events/api/myEventsApi';
import Layout from '@/shared/layouts/Layout';
import { MyEvent, EventFilters, GroupedEvent } from '../types/myEvents';

export default function MyEventsPage() {
  // State management
  const [filters, setFilters] = useState<EventFilters>({
    showUpcoming: true,
    showPast: true,
    showFamily: true,
    searchTerm: '',
  });
  const [selectedEvent, setSelectedEvent] = useState<MyEvent | null>(null);

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
    // Deduplicate events based on unique key (event_id + person_id combination)
    // This provides a robust safety net against backend data inconsistencies
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
    
    return deduplicatedEvents.filter(eventRef => {
      const event = eventRef.event;
      if (!event) return false; // Skip if no event details loaded

      const eventDate = new Date(event.date);
      const now = new Date();
      const isUpcoming = eventDate > now;

      // Date filtering
      if (!filters.showUpcoming && isUpcoming) return false;
      if (!filters.showPast && !isUpcoming) return false;

      // Family filtering
      if (!filters.showFamily && eventRef.person_id) return false;

      // Search filtering
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          event.name.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower) ||
          event.location.toLowerCase().includes(searchLower) ||
          event.ministry.some((m: string) => m.toLowerCase().includes(searchLower))
        );
      }

      return true;
    });
  }, [events, filters]);

  // Event handlers
  const handleEventClick = (event: MyEvent) => {
    setSelectedEvent(event);
  };

  const handleCancelRSVP = async (eventRef: MyEvent) => {
    try {
      await myEventsApi.cancelRSVP(eventRef.event_id, eventRef.person_id);
      refetch(); // Refresh the events list
      // TODO: Show success notification
      console.log('RSVP cancelled successfully');
    } catch (error) {
      // TODO: Show error notification
      console.error('Failed to cancel RSVP:', error);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">My Events</h1>
            <p className="text-gray-600">Manage your event registrations</p>
          </div>
          <p>Loading events...</p>
        </div>
      </Layout>
    );
  }

  // Render error state
  if (error) {
    return (
      <Layout>
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
      </Layout>
    );
  }

  return (
    <Layout>
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
          />
        )}
      </div>
    </Layout>
  );
}