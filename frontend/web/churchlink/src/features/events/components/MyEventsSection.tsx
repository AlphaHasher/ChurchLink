import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useMyEvents } from '../hooks/useMyEvents';
import { MyEventCard } from './MyEventCard';
import { EventFiltersComponent } from './EventFilters';
import { EventDetailsModal } from './EventDetailsModal';
import { myEventsApi } from '@/features/events/api/myEventsApi';
import { getMyProfileInfo } from '@/helpers/UserHelper';
import { MyEvent, EventFilters, GroupedEvent, EventWithGroupedData } from '../types/myEvents';
import { ProfileInfo } from '@/shared/types/ProfileInfo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useRefundRequest } from '../hooks/useRefundRequest';
import { useLocalize } from '@/shared/utils/localizationUtils';

export function MyEventsSection() {
  const localize = useLocalize();
  // State management
  const [filters, setFilters] = useState<EventFilters>({
    showUpcoming: true,
    showPast: true,
    showFamily: true,
    searchTerm: '',
  });
  // State
  const [selectedEvent, setSelectedEvent] = useState<EventWithGroupedData | null>(null);
  const [, setUserProfile] = useState<ProfileInfo | null>(null);
  
  // Cancellation confirmation dialog state
  const [cancelConfirmation, setCancelConfirmation] = useState<{
    isOpen: boolean;
    eventRef: MyEvent | null;
    isProcessing: boolean;
  }>({
    isOpen: false,
    eventRef: null,
    isProcessing: false,
  });

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
    // Safety check - determine if this is a paid event that needs confirmation
    const isPaidEvent = ((eventRef.event?.price ?? 0) > 0);
    const hasPaidStatus = eventRef.computed_payment_status === 'completed';
    
    // For paid events or events with completed payments, show confirmation dialog
    if (isPaidEvent || hasPaidStatus) {
      setCancelConfirmation({
        isOpen: true,
        eventRef: eventRef,
        isProcessing: false,
      });
      return; // Let the confirmation dialog handle the actual cancellation
    }

    // For free events, proceed directly with a simple confirmation
    if (!window.confirm(`Are you sure you want to cancel your RSVP for "${eventRef.event?.name}"?`)) {
      return;
    }

    // Execute the cancellation
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
      
      throw error; // Re-throw so the modal can handle it
    }
  };

  // Handle confirmed cancellation from dialog
  const handleConfirmedCancellation = async (): Promise<void> => {
    const { eventRef } = cancelConfirmation;
    if (!eventRef) return;

    setCancelConfirmation(prev => ({ ...prev, isProcessing: true }));

    try {
      await myEventsApi.cancelRSVP(eventRef.event_id, eventRef.person_id);
      refetch(); // Refresh the events list
      
      // Show success notification
      const personName = eventRef.display_name ? ` for ${eventRef.display_name}` : '';
      toast.success(`RSVP cancelled successfully${personName}`);
      
      // Close the confirmation dialog
      setCancelConfirmation({
        isOpen: false,
        eventRef: null,
        isProcessing: false,
      });
      
    } catch (error: any) {
      console.error('Failed to cancel RSVP:', error);
      
      // Show error notification with more details
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to cancel RSVP';
      toast.error(`Error: ${errorMessage}`);
      
      setCancelConfirmation(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  };

  const { handleRefundRequest } = useRefundRequest();

  // Wrapper to handle refund success and close modal
  const handleRefundRequestWithModalClose = async (eventRef: MyEvent) => {
    try {
      await handleRefundRequest(eventRef, () => {
        // Close modal and refresh events on success
        setSelectedEvent(null);
        // Simple refresh after refund request
        setTimeout(() => {
          refetch();
        }, 500); // Small delay to ensure backend has processed the request
      });
    } catch (error) {
      // Error is already handled in the hook
      console.error('Refund request failed:', error);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <p>{localize('Loading events...')}</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{localize('Error')}: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {localize('Try Again')}
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
              ? localize("You haven't registered for any events yet.")
              : localize('No events match your current filters.')
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
          onRefundRequest={handleRefundRequestWithModalClose}
        />
      )}

      {/* Cancel RSVP Confirmation Dialog */}
      <AlertDialog
        open={cancelConfirmation.isOpen}
        onOpenChange={(open) => {
          if (!open && !cancelConfirmation.isProcessing) {
            setCancelConfirmation({ isOpen: false, eventRef: null, isProcessing: false });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Event Registration</AlertDialogTitle>
            <div className="space-y-3">
                {cancelConfirmation.eventRef && (
                  <>
                    <div>
                      Are you sure you want to cancel your registration for{' '}
                      <span className="font-semibold">"{cancelConfirmation.eventRef.event?.name}"</span>
                      {cancelConfirmation.eventRef.display_name && (
                        <span> for {cancelConfirmation.eventRef.display_name}</span>
                      )}?
                    </div>
                  
                  {/* Show payment warning for paid events */}
                  {(cancelConfirmation.eventRef.event?.price && cancelConfirmation.eventRef.event.price > 0) && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="text-yellow-800">
                        <strong>⚠️ This is a paid event (${cancelConfirmation.eventRef.event.price})</strong>
                        {cancelConfirmation.eventRef.computed_payment_status === 'completed' ? (
                          <div className="mt-2 text-sm">
                            You have already completed payment for this event. Cancelling may require a 
                            separate refund request depending on the event's refund policy.
                          </div>
                        ) : (
                          <div className="mt-2 text-sm">
                            This will cancel your registration and any pending payment.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                    {/* Event date information */}
                    {cancelConfirmation.eventRef.event?.date && (
                      <div className="text-sm text-gray-600">
                        Event Date: {new Date(cancelConfirmation.eventRef.event.date).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={cancelConfirmation.isProcessing}
              onClick={() => {
                if (!cancelConfirmation.isProcessing) {
                  setCancelConfirmation({ isOpen: false, eventRef: null, isProcessing: false });
                }
              }}
            >
              Keep Registration
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedCancellation}
              disabled={cancelConfirmation.isProcessing}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {cancelConfirmation.isProcessing ? 'Cancelling...' : 'Yes, Cancel RSVP'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}