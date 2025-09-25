import { format } from 'date-fns';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { EventWithGroupedData, MyEvent } from '../types/myEvents';

interface EventDetailsModalProps {
  eventRef: EventWithGroupedData | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelRSVP: (eventRef: MyEvent) => Promise<void>;
}

export function EventDetailsModal({ eventRef, isOpen, onClose, onCancelRSVP }: EventDetailsModalProps) {
  if (!eventRef || !eventRef.event) return null;

  const event = eventRef.event;
  const eventDate = new Date(event.date);
  const isUpcoming = eventDate > new Date();
  const isFamilyEvent = Boolean(eventRef.person_id);

  // Access grouped event data if available
  const groupedEventData = eventRef.groupedEventData;
  const allRegistrants = groupedEventData?.allRegistrants || [eventRef];
  
  // Separate user and family registrations for display
  const userRegistration = allRegistrants.find((reg: MyEvent) => !reg.person_id);
  const familyRegistrations = allRegistrants.filter((reg: MyEvent) => reg.person_id);

  const handleCancelRSVP = async () => {
    if (window.confirm(`Cancel registration for "${event.name}"?`)) {
      try {
        await onCancelRSVP(eventRef);
        onClose(); // Close modal only after successful cancellation
      } catch (error) {
        // Error is already handled in the parent component
        console.error('Failed to cancel RSVP:', error);
      }
    }
  };

  const handleCancelFamilyRSVP = async (familyEvent: MyEvent) => {
    const memberName = familyEvent.display_name || 'family member';
    if (window.confirm(`Cancel registration for "${event.name}" for ${memberName}?`)) {
      try {
        await onCancelRSVP(familyEvent);
        onClose(); // Close modal only after successful cancellation
      } catch (error) {
        // Error is already handled in the parent component
        console.error('Failed to cancel RSVP:', error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto pr-4 sm:pr-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{event.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Upcoming/Past badge - moved to top */}
            <div className="flex items-center">
              <div className={`px-3 py-1 rounded-full text-sm ${
                isUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {isUpcoming ? 'Upcoming Event' : 'Past Event'}
              </div>
            </div>

            {/* Event Image - moved to top */}
            {event.image_url && (
              <div className="w-full h-56 bg-gray-200 rounded-lg overflow-hidden">
                <img 
                  src={event.image_url} 
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Ministry Tags - Moved below image */}
            {event.ministry && event.ministry.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Ministries</h3>
                <div className="flex flex-wrap gap-2">
                  {event.ministry.map((ministry, index) => (
                    <span 
                      key={index}
                      className="inline-block px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full font-medium"
                    >
                      {ministry}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Members */}
            {groupedEventData && allRegistrants.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="h-4 w-4" />
                <span className="font-medium">
                  {allRegistrants.length === 1 ? 'Registered' : 'Registered Family Members'}
                </span>
              </div>
              <div className="space-y-2">
                {userRegistration && (
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">You</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelFamilyRSVP(userRegistration)}
                      className="text-xs h-7 px-3 bg-red-600 text-white hover:bg-red-700"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {familyRegistrations.map((familyReg) => {
                  // Better name resolution with multiple fallback options
                  const memberName = familyReg.display_name?.trim() || 
                                   (familyReg.meta?.first_name && familyReg.meta?.last_name 
                                     ? `${familyReg.meta.first_name} ${familyReg.meta.last_name}`.trim()
                                     : (familyReg.meta?.first_name as string)?.trim() || 
                                       (familyReg.meta?.last_name as string)?.trim() || 
                                       'Family Member');
                  
                  return (
                    <div key={familyReg._id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">{memberName}</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelFamilyRSVP(familyReg)}
                        className="text-xs h-7 px-3 bg-red-600 text-white hover:bg-red-700"
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fallback for non-grouped single registration */
            isFamilyEvent && eventRef.display_name && (
              <div className="flex items-center gap-2 text-gray-700">
                <User className="h-4 w-4" />
                <span className="text-sm">Registered for {eventRef.display_name}</span>
              </div>
            )
          )}

          {/* duplicate lower image removed — image now displayed at top */}

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {/* Date & Time */}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium">{format(eventDate, 'MMMM dd, yyyy')}</p>
                  <p className="text-sm text-gray-600">{format(eventDate, 'h:mm a')}</p>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-sm text-gray-600">{event.location}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Capacity */}
              {event.spots > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Registered</p>
                    <p className="text-sm text-gray-600">
                      {event.seats_taken || 0} registered
                    </p>
                  </div>
                </div>
              )}

              {/* Price */}
              {event.price > 0 && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Price</p>
                    <p className="text-sm text-gray-600">${event.price}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Age Requirements */}
          {(event.min_age > 0 || event.max_age > 0) && (
            <div>
              <h3 className="font-medium mb-2">Age Requirements</h3>
              <p className="text-gray-700">
                {event.min_age > 0 && event.max_age > 0 
                  ? `Ages ${event.min_age} - ${event.max_age}`
                  : event.min_age > 0 
                    ? `Ages ${event.min_age}+`
                    : `Ages up to ${event.max_age}`
                }
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            {/* Only show main cancel button for non-grouped single registrations */}
            {!groupedEventData && (
              <Button 
                variant="destructive" 
                onClick={handleCancelRSVP}
                data-testid="confirm-cancel"
              >
                Cancel RSVP
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}