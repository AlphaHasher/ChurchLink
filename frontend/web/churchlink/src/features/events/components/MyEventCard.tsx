import { format } from 'date-fns';
import { 
  Calendar, 
  MapPin, 
  Users, 
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/shared/components/ui/card';
import { GroupedEvent } from '../types/myEvents';

interface MyEventCardProps {
  groupedEvent: GroupedEvent;
  onClick: () => void;
}

export function MyEventCard({ groupedEvent, onClick }: MyEventCardProps) {
  const event = groupedEvent.event;
  if (!event) return null; // Don't render if no event details

  const eventDate = new Date(event.date);
  
  // Registrant details are available via `groupedEvent.registrants` when needed

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2 text-gray-800">{event.name}</h3>
          </div>

          {/* Price / status badge similar to app: show FREE, FULL, or price */}
          <div>
            {event.spots > 0 && (event.spots - (event.seats_taken || 0) <= 0) ? (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-red-600 text-white">
                FULL
              </div>
            ) : event.price === 0 ? (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-gray-600 text-white">
                FREE
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-gray-600 text-white">
                <span className="font-semibold">${event.price}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{format(eventDate, 'MMM dd, yyyy • h:mm a')}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}

        {/* Registration Summary - Combined display */}
        {event.spots > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>
              {(() => {
                // Show registration count and payment status if user has registrations
                if (groupedEvent.allRegistrants.some(r => r.reason === 'rsvp')) {
                  const rsvpRegistrants = groupedEvent.allRegistrants.filter(r => r.reason === 'rsvp');
                  const totalRegistered = rsvpRegistrants.length;
                  
                  // Free events - simple count
                  if (event.price === 0) {
                    return `${totalRegistered} registered`;
                  }

                  // Paid events - show payment status summary
                  const attendees = event.attendees as any[] | undefined;
                  const resolveStatus = (r: any): string | undefined => {
                    // First check if registrant already has payment status
                    if (r.computed_payment_status) return r.computed_payment_status;
                    if (r.payment_status) return r.payment_status;
                    
                    // Then look up in event attendees array (which has enriched data)
                    if (!Array.isArray(attendees)) return undefined;
                    
                    const match = attendees.find(a => {
                      try {
                        // Match by key (most reliable)
                        if (r.key && a?.key && String(a.key) === String(r.key)) return true;
                        // Match by person_id for family members
                        if (r.person_id && a?.person_id && String(a.person_id) === String(r.person_id)) return true;
                        // Match user registrations (no person_id)
                        if (!r.person_id && !a?.person_id && a?.user_uid === (r as any).user_uid) return true;
                      } catch (e) {}
                      return false;
                    });
                    
                    // Return computed status from enriched attendee data
                    return match?.computed_payment_status || match?.payment_status;
                  };

                  const pendingCount = rsvpRegistrants.filter(r => {
                    const s = resolveStatus(r);
                    // Count as pending if no status or status indicates payment needed
                    return !s || s === 'pending' || s === 'awaiting_payment' || s === 'pending_door';
                  }).length;

                  const refundRequestedCount = rsvpRegistrants.filter(r => {
                    const s = resolveStatus(r);
                    return s === 'refund_requested';
                  }).length;

                  const refundedCount = rsvpRegistrants.filter(r => {
                    const s = resolveStatus(r);
                    return s === 'refunded';
                  }).length;

                  // Prioritize refund statuses in display
                  if (refundRequestedCount > 0) {
                    if (refundRequestedCount === totalRegistered) {
                      return `${totalRegistered} registered - refund requested`;
                    } else {
                      return `${totalRegistered} registered - ${refundRequestedCount} refund requested`;
                    }
                  } else if (refundedCount > 0) {
                    if (refundedCount === totalRegistered) {
                      return `${totalRegistered} registered - refunded`;
                    } else {
                      return `${totalRegistered} registered - ${refundedCount} refunded`;
                    }
                  } else if (pendingCount === 0) {
                    return `${totalRegistered} registered - all paid`;
                  } else {
                    return `${totalRegistered} registered - ${pendingCount} required payment`;
                  }
                } else {
                  // Show general event registration count if user not registered
                  return `${groupedEvent.registration_count || event.seats_taken || 0} registered`;
                }
              })()}
            </span>
          </div>
        )}

        {/* NOTE: Ministries, registrant summary, and description removed to match app design */}
      </CardContent>
    </Card>
  );
}