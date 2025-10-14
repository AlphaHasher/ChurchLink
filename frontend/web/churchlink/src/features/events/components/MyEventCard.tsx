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
                  const pendingCount = rsvpRegistrants.filter(r => 
                    !r.payment_status || 
                    r.payment_status === 'awaiting_payment' || 
                    r.payment_status === 'pending_door'
                  ).length;

                  if (pendingCount === 0) {
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