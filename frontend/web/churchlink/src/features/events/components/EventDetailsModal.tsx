import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { EventWithGroupedData, MyEvent } from '../types/myEvents';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { getMyFamilyMembers } from '@/helpers/UserHelper';
import { getPublicUrl } from '@/helpers/MediaInteraction';

interface EventDetailsModalProps {
  eventRef: EventWithGroupedData | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelRSVP: (eventRef: MyEvent) => Promise<void>;
  onRefundRequest?: (eventRef: MyEvent) => Promise<void>;
}

// Constants
const PAID_STATUSES = new Set<string>(['completed', 'paid']);
const DOOR_STATUSES = new Set<string>(['pending_door']);
const PENDING_STATUSES = new Set<string>(['awaiting_payment', 'pending']);
const REFUND_STATUSES = new Set<string>(['refund_requested', 'refunded', 'partially_refunded']);


export function EventDetailsModal({ 
  eventRef, 
  isOpen, 
  onClose, 
  onCancelRSVP,
  onRefundRequest
}: EventDetailsModalProps) {
  if (!eventRef || !eventRef.event) return null;
  const { user } = useAuth();

  const event = eventRef.event;
  const eventDate = new Date(event.date);
  const isUpcoming = eventDate > new Date();
  const isFamilyEvent = Boolean(eventRef.person_id);

  // Access grouped event data if available
  const groupedEventData = eventRef.groupedEventData;
  const rawRegistrants = groupedEventData?.allRegistrants || [eventRef];

  // Normalize registrant objects for consistent UI handling
  const normalizeRegistrant = (r: any, idx: number) => {
    const isSelf = r.person_id == null;
    const display_name = (r.display_name || r.name || (isSelf ? 'You' : 'Family Member')) as string;
    const person_id = r.person_id ?? null;
    const reason = r.reason || 'rsvp';
    const payment_status = r.payment_status ?? undefined;
    const payment_method = r.payment_method ?? undefined;
    const key = r.key ?? `${(r.user_uid || (user as any)?.uid || 'unknown')}|${person_id ? String(person_id) : 'self'}|${reason}|${r.scope || 'series'}`;
    const addedOn = r.addedOn || r.registered_on || new Date().toISOString();

    return {
      ...r,
      display_name,
      person_id,
      reason,
      payment_status,
      payment_method,
      key,
      addedOn,
      _id: r._id ?? key + `-${idx}`,
    } as any;
  };

  const allRegistrants = rawRegistrants.map((r: any, i: number) => normalizeRegistrant(r, i));

  // Event type detection
  const isPaidEvent = event.price > 0;
  const hasPaymentOptions = (event.payment_options?.length ?? 0) > 0;
  const requiresPayment = () => isPaidEvent && hasPaymentOptions;
  
  // Separate user and family registrations for display
  const userRegistration = allRegistrants.find((reg: MyEvent) => !reg.person_id);
  const familyRegistrations = allRegistrants.filter((reg: MyEvent) => reg.person_id);

  // Payment status calculations
  const getRSVPRegistrants = () => allRegistrants.filter(r => r.reason === 'rsvp');
  
  const getPaymentCounts = () => {
    const rsvpRegistrants = getRSVPRegistrants();
    
    return {
      total: rsvpRegistrants.length,
      paidOnline: rsvpRegistrants.filter(r => PAID_STATUSES.has(getRegistrantPaymentStatus(r) ?? '')).length,
      payAtDoor: rsvpRegistrants.filter(r => DOOR_STATUSES.has(getRegistrantPaymentStatus(r) ?? '')).length,
      pending: rsvpRegistrants.filter(r => PENDING_STATUSES.has(getRegistrantPaymentStatus(r) ?? '')).length,
      refundRelated: rsvpRegistrants.filter(r => REFUND_STATUSES.has(getRegistrantPaymentStatus(r) ?? '')).length,
    };
  };

  // Get display name for a registrant
  const getRegistrantDisplayName = (registrant: MyEvent): string => {
    if (!registrant.person_id) return 'You';

    // Check familyMap first (has the actual family member names from family API)
    const resolved = familyMap[registrant.person_id];
    if (resolved) return resolved;

    // Trust backend-populated display_name
    const backendName = (registrant.display_name || '').trim();
    if (backendName && backendName !== 'Family Member') {
      return backendName;
    }

    // Check event.attendees for backend-populated display_name
    const attendees = event.attendees || [];
    const match = attendees.find(a => {
      if (registrant.person_id === null || registrant.person_id === undefined) {
        return false; // For display name lookup, we only care about family members with person_id
      }
      return a?.person_id != null && String(a.person_id) === String(registrant.person_id);
    });
    
    if (match?.display_name && match.display_name.trim() && match.display_name !== 'Family Member') {
      return match.display_name.trim();
    }

    return 'Family Member';
  };

  // Get payment status for a registrant
  const getRegistrantPaymentStatus = (registrant: MyEvent): string | undefined => {
    // Get from event's attendees array (backend stores payment_status directly)
    const attendees = event.attendees || [];
    const matchingAttendee = attendees.find(attendee => {
      // Handle null/undefined person_id cases first
      if (registrant.person_id === null || registrant.person_id === undefined) {
        if (attendee.person_id === null || attendee.person_id === undefined) {
          return attendee.user_uid === user?.uid;
        }
        return false;
      }
      
      // Both have person_id values - normalize and compare
      if (attendee.person_id != null) {
        return String(attendee.person_id) === String(registrant.person_id);
      }
      
      return false;
    });
    
    // Use direct payment_status first, then computed as fallback
    return matchingAttendee?.payment_status || 
           matchingAttendee?.computed_payment_status || 
           registrant.computed_payment_status;
  };

  const handleCancelRSVP = async (registrant?: MyEvent) => {
    const targetEvent = registrant || eventRef;
    const memberName = registrant ? getRegistrantDisplayName(registrant) : 'your';
    const confirmMessage = registrant 
      ? `Cancel registration for "${event.name}" for ${memberName}?`
      : `Cancel registration for "${event.name}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        await onCancelRSVP(targetEvent);
        onClose();
      } catch (error) {
        console.error('Failed to cancel RSVP:', error);
      }
    }
  };

  // Handle refund request
  const handleModalRefundRequest = async (registrant?: MyEvent) => {
    if (!onRefundRequest) return;
    
    try {
      const targetEvent = registrant || eventRef;
      
      if (targetEvent) {
        await onRefundRequest(targetEvent);
        // Don't close modal, let user see the updated status
      }
    } catch (error) {
      console.error('Failed to request refund:', error);
    }
  };

  // Helper to determine if refund request is available
  const canRequestRefund = (registrant: MyEvent): boolean => {
    // Find the attendee record that matches this registrant
    const attendees = event.attendees || [];
    const attendee = attendees.find(att => {
      if (registrant.person_id === null) return att.person_id === null;
      return att.person_id != null
        && String(att.person_id) === String(registrant.person_id);
    });

    if (!attendee) return false;

    // Use direct payment status first, then computed
    const paymentStatus = attendee.payment_status || attendee.computed_payment_status;
    const hasPayment = paymentStatus === 'completed';
    const notRefunded = (paymentStatus as string) !== 'failed' && (paymentStatus as string) !== 'refunded' && (paymentStatus as string) !== 'refund_requested' && (paymentStatus as string) !== 'partially_refunded';
    const isPaidEvent = (event.price || 0) > 0;
    
    return hasPayment && notRefunded && isPaidEvent && Boolean(onRefundRequest);
  };


  // Helper to get cancellation button text and styling
  const getCancellationInfo = (registrant: MyEvent) => {
    const paymentStatus = getRegistrantPaymentStatus(registrant);
    const isPaidEvent = (event.price || 0) > 0;

    if (paymentStatus === 'refund_requested') {
      return {
        text: 'Refund Pending',
        className: 'text-xs h-7 px-3 bg-gray-400 text-white cursor-not-allowed',
        disabled: true,
        tooltip: 'Cannot cancel while refund is being processed'
      };
    }

    if (isPaidEvent && paymentStatus === 'completed') {
      return {
        text: 'Request Refund First',
        className: 'text-xs h-7 px-3 bg-gray-400 text-white cursor-not-allowed',
        disabled: true,
        tooltip: 'Must request refund before canceling paid registration'
      };
    }

    return {
      text: 'Cancel',
      className: 'text-xs h-7 px-3 bg-red-600 text-white hover:bg-red-700',
      disabled: false,
      tooltip: 'Cancel registration'
    };
  };

  // Render payment status badge
  const renderPaymentStatus = (registrant: MyEvent) => {
    if (registrant.reason !== 'rsvp') return null;
    
    // Free events
    if (event.price === 0) {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 inline-block mt-1">
          ✅ Registered (Free Event)
        </span>
      );
    }

    // Get payment status using our centralized logic
    const status = getRegistrantPaymentStatus(registrant);
    
    const statusConfigs = {
      'completed': { bg: 'bg-green-100 text-green-700', text: '✅ Paid Online' },
      'failed': { bg: 'bg-red-100 text-red-700', text: '❌ Payment Failed' },
      'pending_door': { bg: 'bg-yellow-100 text-yellow-700', text: '🚪 Pay at Door' },
      'pending': { bg: 'bg-blue-100 text-blue-700', text: '⏳ Payment Pending' },
      'refund_requested': { bg: 'bg-orange-100 text-orange-700', text: '🔄 Refund Requested' },
      'refunded': { bg: 'bg-gray-100 text-gray-700', text: '↩️ Refunded' },
      'partially_refunded': { bg: 'bg-purple-100 text-purple-700', text: '🔄 Partially Refunded' },
      'not_required': { bg: 'bg-green-100 text-green-700', text: '✅ Registered' }
    } as const;

    if (status && status in statusConfigs) {
      const config = statusConfigs[status as keyof typeof statusConfigs];
      return (
        <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${config.bg}`}>
          {config.text}
        </span>
      );
    }

    // Unrecognized status - show payment required
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 inline-block mt-1">
        ❌ Payment Required
      </span>
    );
  };

  const [familyMap, setFamilyMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    
    const loadFamily = async () => {
      try {
        const hasFamily = allRegistrants.some(r => Boolean(r.person_id));
        if (!hasFamily) return;
        
        const members = await getMyFamilyMembers();
        if (!mounted) return;
        
        const map: Record<string, string> = {};
        members.forEach(m => {
          map[m.id] = `${m.first_name} ${m.last_name}`.trim();
        });
        setFamilyMap(map);
      } catch (e) {
        console.error('Failed to load family members:', e);
      }
    };

    if (isOpen) {
      loadFamily();
    }
    
    return () => { 
      mounted = false; 
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] overflow-y-auto pr-4 sm:pr-6 z-[9999]"
        style={{ zIndex: 9999 }}
      >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{event.name}</DialogTitle>
            <DialogDescription className="text-gray-600">
              View and manage your registration for this event
            </DialogDescription>
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
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: event.image_url 
                      ? `url("${getPublicUrl(event.image_url)}"), url("/assets/default-thumbnail.jpg")`
                      : `url("/assets/default-thumbnail.jpg")`,
                  }}
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

            {/* Payment Status Overview */}
            {isPaidEvent && allRegistrants.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Payment Status Overview</h4>
                <p className="text-sm text-blue-700 mb-2">
                  This event supports multiple payment methods. Each person's payment status is tracked individually:
                </p>
                <div className="space-y-1 text-sm">
                  {getRSVPRegistrants().map((registrant, index) => {
                    const status = getRegistrantPaymentStatus(registrant as MyEvent);
                    const getStatusText = (status: string | undefined) => {
                      if (status === 'completed') return '✅ Paid via PayPal';
                      if (status === 'pending_door') return '🚪 Will pay at door';
                      if (status === 'awaiting_payment' || status === 'pending') return '⏳ PayPal processing';
                      if (status === 'refund_requested') return '🔄 Refund requested';
                      if (status === 'refunded') return '↩️ Refunded';
                      if (status === 'partially_refunded') return '🔄 Partially refunded';
                      return '❌ Payment required';
                    };

                    return (
                      <div key={`status-${registrant.person_id || 'user'}-${index}`} className="flex items-center justify-between">
                        <span className="font-medium text-blue-800">
                          {getRegistrantDisplayName(registrant)}:
                        </span>
                        <span className="text-blue-600">
                          {getStatusText(status)}
                        </span>
                      </div>
                    );
                  })}
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
                      const counts = getPaymentCounts();
                      if (counts.total === 0) return null;

                      const parts = [];
                      if (counts.paidOnline > 0) parts.push(`${counts.paidOnline} paid online`);
                      if (counts.payAtDoor > 0) parts.push(`${counts.payAtDoor} pay at door`);
                      if (counts.pending > 0) parts.push(`${counts.pending} pending`);
                      if (counts.refundRelated > 0) parts.push(`${counts.refundRelated} refund related`);

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
                            {renderPaymentStatus(userRegistration)}
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
                      <div className="flex gap-2">
                        {canRequestRefund(userRegistration) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleModalRefundRequest(userRegistration)}
                            className="text-xs h-7 px-3 border-orange-500 text-orange-600 hover:bg-orange-50"
                          >
                            Request Refund
                          </Button>
                        )}
                        {(() => {
                          const cancellationInfo = getCancellationInfo(userRegistration);
                          return (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={cancellationInfo.disabled ? undefined : () => handleCancelRSVP(userRegistration)}
                              className={cancellationInfo.className}
                              disabled={cancellationInfo.disabled}
                              title={cancellationInfo.tooltip}
                            >
                              {cancellationInfo.text}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                {familyRegistrations.map((familyReg) => {
                  // Use centralized name resolution helper so we consistently
                  // display family member names when available.
                  const memberName = getRegistrantDisplayName(familyReg);
                  
                  return (
                    <div key={familyReg._id} className="py-3 px-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-gray-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-800">{memberName}</span>
                              {renderPaymentStatus(familyReg)}
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
                        <div className="flex gap-2">
                          {canRequestRefund(familyReg) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleModalRefundRequest(familyReg)}
                              className="text-xs h-7 px-3 border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              Request Refund
                            </Button>
                          )}
                          {(() => {
                            const cancellationInfo = getCancellationInfo(familyReg);
                            return (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={cancellationInfo.disabled ? undefined : () => handleCancelRSVP(familyReg)}
                                className={cancellationInfo.className}
                                disabled={cancellationInfo.disabled}
                                title={cancellationInfo.tooltip}
                              >
                                {cancellationInfo.text}
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Payment Summary */}
                {isPaidEvent && getPaymentCounts().total > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Payment Summary</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-blue-700">Total Registered: <span className="font-medium">{getPaymentCounts().total}</span></div>
                        <div className="text-blue-700">Event Price: <span className="font-medium">${event.price.toFixed(2)} per person</span></div>
                      </div>
                      <div>
                        {(() => {
                          const counts = getPaymentCounts();
                          return (
                            <div className="space-y-1">
                              {counts.paidOnline > 0 && (
                                <div className="text-green-700">✅ Paid Online: {counts.paidOnline}</div>
                              )}
                              {counts.payAtDoor > 0 && (
                                <div className="text-yellow-700">🚪 Pay at Door: {counts.payAtDoor}</div>
                              )}
                              {counts.pending > 0 && (
                                <div className="text-red-700">❌ Pending Payment: {counts.pending}</div>
                              )}
                              {counts.refundRelated > 0 && (
                                <div className="text-orange-700">🔄 Refund Related: {counts.refundRelated}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-sm font-medium text-blue-800">
                        Total Amount Expected: ${(event.price * getPaymentCounts().total).toFixed(2)}
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
            {/* Only show main buttons for non-grouped single registrations */}
            {!groupedEventData && userRegistration && (
              <div className="flex gap-3">
                {canRequestRefund(userRegistration) && (
                  <Button 
                    variant="outline"
                    onClick={() => handleModalRefundRequest()}
                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                  >
                    Request Refund
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={() => handleCancelRSVP()}
                  data-testid="confirm-cancel"
                >
                  Cancel RSVP
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}