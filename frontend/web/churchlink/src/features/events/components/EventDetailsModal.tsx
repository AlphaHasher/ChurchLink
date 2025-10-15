import { format } from 'date-fns';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign,
  User,
  CreditCard
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { EventPayPalButton } from './EventPayPalButton';
import { EventWithGroupedData, MyEvent } from '../types/myEvents';

interface EventDetailsModalProps {
  eventRef: EventWithGroupedData | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelRSVP: (eventRef: MyEvent) => Promise<void>;
}

export function EventDetailsModal({ 
  eventRef, 
  isOpen, 
  onClose, 
  onCancelRSVP
}: EventDetailsModalProps) {
  if (!eventRef || !eventRef.event) return null;

  const event = eventRef.event;
  const eventDate = new Date(event.date);
  const isUpcoming = eventDate > new Date();
  const isFamilyEvent = Boolean(eventRef.person_id);

  // Access grouped event data if available
  const groupedEventData = eventRef.groupedEventData;
  const allRegistrants = groupedEventData?.allRegistrants || [eventRef];

  // Event type detection
  const isFreeEvent = event.price === 0;
  const isPaidEvent = event.price > 0;
  const hasPaymentOptions = (event.payment_options?.length ?? 0) > 0;
  const hasPayPalOption = () => event.payment_options?.includes('PayPal') || event.payment_options?.includes('paypal');
  const hasDoorPaymentOption = () => event.payment_options?.includes('door');
  const requiresPayment = () => isPaidEvent && hasPaymentOptions;
  const supportsMixedPayments = () => isPaidEvent && event.payment_options && event.payment_options.length > 1;
  
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

  // Render payment status badge based on event type and registrant status
  const renderPaymentStatus = (registrant: MyEvent, isUser: boolean = false) => {
    const displayName = isUser ? 'You' : registrant.display_name || 'Family Member';
    
    // Only show payment status for RSVP registrations
    if (registrant.reason !== 'rsvp') {
      return null;
    }

    // Free events - just show "Registered"
    if (event.price === 0) {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 inline-block mt-1">
          ✅ Registered (Free Event)
        </span>
      );
    }

    // Paid events - show payment status based on what we have
    if (event.price > 0) {
      // If we have payment status, use it
      if (registrant.payment_status) {
        const statusMap = {
          'completed': { 
            bg: 'bg-green-100 text-green-700', 
            text: '✅ Paid Online',
            description: `${displayName} has completed PayPal payment`
          },
          'paid': { 
            bg: 'bg-green-100 text-green-700', 
            text: '✅ Paid Online',
            description: `${displayName} has completed PayPal payment`
          },
          'pending_door': { 
            bg: 'bg-yellow-100 text-yellow-700', 
            text: '🚪 Pay at Door',
            description: `${displayName} will pay $${event.price} at the door`
          },
          'awaiting_payment': { 
            bg: 'bg-blue-100 text-blue-700', 
            text: '⏳ PayPal Processing',
            description: `${displayName}'s PayPal payment is being processed`
          }
        };
        
        const config = statusMap[registrant.payment_status] || {
          bg: 'bg-red-100 text-red-700',
          text: '❌ Payment Required',
          description: `${displayName} needs to complete payment`
        };
        
        return (
          <span 
            className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${config.bg}`}
            title={config.description}
          >
            {config.text}
          </span>
        );
      }

      // No payment status but paid event - payment required
      return (
        <span 
          className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 inline-block mt-1"
          title={`${displayName} needs to complete payment of $${event.price}`}
        >
          ❌ Payment Required
        </span>
      );
    }

    // Should not reach here, but just in case
    return null;
  };

  // Debug: Log registrant data to help troubleshoot payment status
  console.log('🐛 [EventDetailsModal] All registrants:', allRegistrants.map(r => ({
    name: r.display_name || 'User',
    person_id: r.person_id,
    reason: r.reason,
    payment_method: r.payment_method,
    payment_status: r.payment_status
  })));

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

            {/* Mixed Payment Status Alert */}
            {isPaidEvent && allRegistrants.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Payment Status Overview</h4>
                <p className="text-sm text-blue-700 mb-2">
                  This event supports multiple payment methods. Each person's payment status is tracked individually:
                </p>
                <div className="space-y-1 text-sm">
                  {allRegistrants.filter(r => r.reason === 'rsvp').map((registrant, index) => (
                    <div key={`status-${registrant.person_id || 'user'}-${index}`} className="flex items-center justify-between">
                      <span className="font-medium text-blue-800">
                        {registrant.display_name || 'You'}:
                      </span>
                      <span className="text-blue-600">
                        {(registrant.payment_status === 'completed' || registrant.payment_status === 'paid')
                          ? '✅ Paid via PayPal' 
                          : registrant.payment_status === 'pending_door'
                          ? '🚪 Will pay at door'
                          : registrant.payment_status === 'awaiting_payment'
                          ? '⏳ PayPal processing'
                          : '❌ Payment required'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Members */}
            {groupedEventData && allRegistrants.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">
                    {allRegistrants.length === 1 ? 'Registered' : 'Registered Family Members'}
                  </span>
                </div>
                {/* Payment Status Summary */}
                {isPaidEvent && (
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const rsvpRegistrants = allRegistrants.filter(r => r.reason === 'rsvp');
                      const completedPayments = rsvpRegistrants.filter(r => r.payment_status === 'completed' || r.payment_status === 'paid').length;
                      const doorPayments = rsvpRegistrants.filter(r => r.payment_status === 'pending_door').length;
                      const pendingPayments = rsvpRegistrants.filter(r => !r.payment_status || r.payment_status === 'awaiting_payment').length;
                      
                      if (rsvpRegistrants.length === 0) return null;
                      
                      const parts = [];
                      if (completedPayments > 0) parts.push(`${completedPayments} paid online`);
                      if (doorPayments > 0) parts.push(`${doorPayments} pay at door`);
                      if (pendingPayments > 0) parts.push(`${pendingPayments} pending`);
                      
                      return parts.length > 0 ? parts.join(' • ') : 'All paid';
                    })()}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {userRegistration && (
                  <div className="py-3 px-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-800">You</span>
                            {renderPaymentStatus(userRegistration, true)}
                          </div>
                          <div className="space-y-1 text-xs text-gray-500">
                            <div>Registered: {new Date(userRegistration.addedOn).toLocaleDateString()}</div>
                            {userRegistration.payment_method && (
                              <div>Payment Method: {userRegistration.payment_method === 'paypal' ? 'PayPal' : 'Pay at Door'}</div>
                            )}
                            {event.price > 0 && (
                              <div>Amount: ${event.price.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
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
                    <div key={familyReg._id} className="py-3 px-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-gray-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-800">{memberName}</span>
                              {renderPaymentStatus(familyReg, false)}
                            </div>
                            <div className="space-y-1 text-xs text-gray-500">
                              <div>Registered: {new Date(familyReg.addedOn).toLocaleDateString()}</div>
                              {familyReg.payment_method && (
                                <div>Payment Method: {familyReg.payment_method === 'paypal' ? 'PayPal' : 'Pay at Door'}</div>
                              )}
                              {event.price > 0 && (
                                <div>Amount: ${event.price.toFixed(2)}</div>
                              )}
                              {familyReg.person_id && (
                                <div>Family Member ID: {familyReg.person_id}</div>
                              )}
                            </div>
                          </div>
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
                    </div>
                  );
                })}
                
                {/* Payment Summary */}
                {isPaidEvent && allRegistrants.filter(r => r.reason === 'rsvp').length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Payment Summary</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-blue-700">Total Registered: <span className="font-medium">{allRegistrants.filter(r => r.reason === 'rsvp').length}</span></div>
                        <div className="text-blue-700">Event Price: <span className="font-medium">${event.price.toFixed(2)} per person</span></div>
                      </div>
                      <div>
                        {(() => {
                          const rsvpRegistrants = allRegistrants.filter(r => r.reason === 'rsvp');
                          const paidOnline = rsvpRegistrants.filter(r => r.payment_status === 'completed' || r.payment_status === 'paid').length;
                          const payAtDoor = rsvpRegistrants.filter(r => r.payment_status === 'pending_door').length;
                          const pending = rsvpRegistrants.filter(r => !r.payment_status || r.payment_status === 'awaiting_payment').length;
                          
                          return (
                            <div className="space-y-1">
                              {paidOnline > 0 && <div className="text-green-700">✅ Paid Online: {paidOnline}</div>}
                              {payAtDoor > 0 && <div className="text-yellow-700">🚪 Pay at Door: {payAtDoor}</div>}
                              {pending > 0 && <div className="text-red-700">❌ Pending Payment: {pending}</div>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-sm font-medium text-blue-800">
                        Total Amount Expected: ${(event.price * allRegistrants.filter(r => r.reason === 'rsvp').length).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Price and Payment Information */}
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <p className="font-medium">Price</p>
                  {event.price === 0 ? (
                    <div>
                      <p className="text-sm text-green-600 font-medium">Free Event</p>
                      <p className="text-xs text-gray-500">No payment required</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">${event.price.toFixed(2)}</p>
                      {/* Payment method options */}
                      {event.payment_options && event.payment_options.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {event.payment_options.includes('paypal') && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              💳 PayPal Available
                            </span>
                          )}
                          {event.payment_options.includes('door') && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                              🚪 Pay at Door
                            </span>
                          )}
                        </div>
                      )}
                      {requiresPayment() && (
                        <p className="text-xs text-blue-600 font-medium mt-1">Payment required before RSVP</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Button for events requiring payment */}
              {event.price > 0 && requiresPayment() && hasPayPalOption() && isUpcoming && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Required
                  </h4>
                  <p className="text-sm text-blue-700 mb-3">
                    You must complete payment before you can RSVP to this event.
                  </p>
                  <EventPayPalButton
                    eventId={event.id}
                    price={event.price}
                    onPaymentError={(error) => {
                      console.error('Payment error:', error);
                    }}
                  />
                  {event.refund_policy && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-600 font-medium">Refund Policy:</p>
                      <p className="text-xs text-blue-700">{event.refund_policy}</p>
                    </div>
                  )}
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
          <div className="flex justify-between pt-4 border-t">
            {/* Only show main cancel button for non-grouped single registrations */}
            {!groupedEventData && userRegistration && (
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