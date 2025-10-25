import { format } from 'date-fns';
import { useEffect, useState } from 'react';
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
import { useAuth } from '@/features/auth/hooks/auth-context';
import { getMyFamilyMembers } from '@/helpers/UserHelper';
import { getPublicUrl } from '@/helpers/MediaInteraction';

interface EventDetailsModalProps {
  eventRef: EventWithGroupedData | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelRSVP: (eventRef: MyEvent) => Promise<void>;
}

// Constants
const PAID_STATUSES = new Set<string>(['completed', 'paid']);
const DOOR_STATUSES = new Set<string>(['pending_door']);
const PENDING_STATUSES = new Set<string>(['awaiting_payment', 'pending']);

const isNotRequired = (status?: string | null): boolean => status === 'not_required';

export function EventDetailsModal({ 
  eventRef, 
  isOpen, 
  onClose, 
  onCancelRSVP
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
  const hasPayPalOption = () => event.payment_options?.includes('PayPal') || event.payment_options?.includes('paypal');
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
      notRequired: rsvpRegistrants.filter(r => isNotRequired(getRegistrantPaymentStatus(r))).length,
    };
  };

  // Get display name for a registrant
  const getRegistrantDisplayName = (registrant: MyEvent): string => {
    if (!registrant.person_id) return 'You';

    // Check familyMap first (this has the actual family member names)
    if (registrant.person_id) {
      const resolved = familyMap[registrant.person_id];
      if (resolved) return resolved;
    }

    // Only check display_name if it's not the generic "Family Member"
    const name = (registrant.display_name || '').trim();
    if (name && name !== 'Family Member') return name;

    // Check event.attendees for name information
    const attendees = (event.attendees as any[] | undefined) ?? [];
    if (Array.isArray(attendees) && attendees.length > 0) {
      const match = attendees.find(a => {
        return registrant.person_id && a?.person_id && String(a.person_id) === String(registrant.person_id);
      });
      
      if (match) {
        // Try various name fields from attendees
        const attendeeName = match.display_name || match.name || match.full_name || match.fullName;
        if (attendeeName && String(attendeeName).trim()) {
          return String(attendeeName).trim();
        }
        
        // Try first + last name combination
        const first = match.first_name || match.firstName;
        const last = match.last_name || match.lastName;
        if (first && last) {
          return `${first} ${last}`.trim();
        }
        if (first) return String(first).trim();
        if (last) return String(last).trim();
      }
    }

    // Check alternative name fields on registrant
    const altNameFields = ['name', 'full_name', 'fullName', 'displayName'];
    for (const field of altNameFields) {
      const val = (registrant as any)[field];
      if (val && String(val).trim()) return String(val).trim();
    }

    // Check meta fields
    const meta = registrant.meta as any | undefined;
    if (meta) {
      const first = meta.first_name || meta.firstName || meta.given_name || meta.first;
      const last = meta.last_name || meta.lastName || meta.family_name || meta.last;
      if (first && last) return `${first} ${last}`.trim();
      if (first) return String(first).trim();
      if (last) return String(last).trim();
      if (meta.name || meta.full_name || meta.fullName) {
        return String(meta.name || meta.full_name || meta.fullName).trim();
      }
    }

    return 'Family Member';
  };

  // Get payment status for a registrant
  const getRegistrantPaymentStatus = (registrant: MyEvent): string | undefined => {
    // PRIORITY 1: Direct registrant payment_status
    if (registrant.payment_status) {
      return registrant.payment_status;
    }

    // PRIORITY 2: Check attendees array (contains the correct payment statuses)
    const attendees = (event.attendees as any[] | undefined) ?? [];
    if (Array.isArray(attendees) && attendees.length > 0) {
      const match = attendees.find(a => {
        try {
          // For family members: match by person_id
          if (registrant.person_id && a?.person_id && String(a.person_id) === String(registrant.person_id)) {
            return true;
          }
          
          // For self registrations: match by user_uid and null person_id
          const currentUid = (user as any | undefined)?.uid;
          if (!registrant.person_id && !a?.person_id && currentUid && a?.user_uid && a.user_uid === currentUid) {
            return true;
          }
          
          // Also check by scope matching (series vs occurrence) as additional validation
          if (registrant.scope && a?.scope && registrant.scope === a.scope) {
            // If scopes match, double-check the person matching
            if (registrant.person_id && a?.person_id && String(a.person_id) === String(registrant.person_id)) {
              return true;
            }
            if (!registrant.person_id && !a?.person_id && currentUid && a?.user_uid && a.user_uid === currentUid) {
              return true;
            }
          }
        } catch (e) {
          // ignore matching errors
        }
        return false;
      });

      if (match?.payment_status) {
        return match.payment_status;
      }
    }

    return undefined;
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

  // Render payment status badge
  const renderPaymentStatus = (registrant: MyEvent, isUser: boolean = false) => {
    if (registrant.reason !== 'rsvp') return null;

    const displayName = isUser ? 'You' : registrant.display_name || 'Family Member';
    
    // Free events
    if (event.price === 0) {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 inline-block mt-1">
          ✅ Registered (Free Event)
        </span>
      );
    }

    // Paid events
    const status = getRegistrantPaymentStatus(registrant);
    const statusConfigs = {
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
    } as const;

    if (status && status in statusConfigs) {
      const config = statusConfigs[status as keyof typeof statusConfigs];
      return (
        <span 
          className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${config.bg}`}
          title={config.description}
        >
          {config.text}
        </span>
      );
    }

    if (isNotRequired(status)) {
      return (
        <span 
          className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 inline-block mt-1" 
          title={`${displayName} does not require payment`}
        >
          ℹ️ No payment required
        </span>
      );
    }

    return (
      <span 
        className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 inline-block mt-1"
        title={`${displayName} needs to complete payment of $${event.price}`}
      >
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
                      if (status === 'completed' || status === 'paid') return '✅ Paid via PayPal';
                      if (status === 'pending_door') return '🚪 Will pay at door';
                      if (status === 'awaiting_payment' || status === 'pending') return '⏳ PayPal processing';
                      if (isNotRequired(status)) return 'ℹ️ No payment required';
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
                      if (counts.notRequired > 0) parts.push(`${counts.notRequired} no payment required`);

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
                        onClick={() => handleCancelRSVP(userRegistration)}
                        className="text-xs h-7 px-3 bg-red-600 text-white hover:bg-red-700"
                      >
                        Cancel
                      </Button>
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
                          onClick={() => handleCancelRSVP(familyReg)}
                          className="text-xs h-7 px-3 bg-red-600 text-white hover:bg-red-700"
                        >
                          Cancel
                        </Button>
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
                              {counts.notRequired > 0 && (
                                <div className="text-blue-700">ℹ️ No Payment Required: {counts.notRequired}</div>
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
            {/* Only show main cancel button for non-grouped single registrations */}
            {!groupedEventData && userRegistration && (
              <Button 
                variant="destructive" 
                onClick={() => handleCancelRSVP()}
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