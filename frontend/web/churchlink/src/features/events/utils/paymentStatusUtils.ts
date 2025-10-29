/**
 * Payment status utilities for event registrations
 * Maps backend RegistrationPaymentStatus enum values to consistent frontend buckets
 */

// Backend RegistrationPaymentStatus enum values
export type BackendPaymentStatus = 
  | "not_required"
  | "pending" 
  | "completed"
  | "failed"
  | "refund_requested"
  | "refunded"
  | "partially_refunded"
  | "awaiting_payment"  // Frontend-specific mapping
  | "pending_door";     // Frontend-specific mapping

// Frontend payment status buckets
export type PaymentStatusBucket = 
  | "pending"
  | "paid" 
  | "failed"
  | "refund_requested"
  | "refunded"
  | "partially_refunded";

/**
 * Maps backend payment status values to consistent frontend buckets
 * @param status - The backend payment status value
 * @returns The mapped frontend bucket
 */
export function mapPaymentStatusToBucket(status: string | undefined | null): PaymentStatusBucket {
  if (!status) return "pending";
  
  const normalizedStatus = status.toLowerCase();
  
  switch (normalizedStatus) {
    // Paid bucket
    case "completed":
    case "not_required":
      return "paid";
    
    // Pending bucket  
    case "pending":
    case "awaiting_payment":
    case "pending_door":
      return "pending";
    
    // Failed bucket
    case "failed":
      return "failed";
    
    // Refund buckets
    case "refund_requested":
      return "refund_requested";
    
    case "refunded":
      return "refunded";
    
    case "partially_refunded":
      return "partially_refunded";
    
    // Default fallback
    default:
      console.warn(`Unknown payment status: ${status}, defaulting to pending`);
      return "pending";
  }
}

/**
 * Groups registrants by their payment status buckets
 * @param registrants - Array of registrants with payment status
 * @param attendees - Optional array of enriched attendee data
 * @returns Object with counts for each status bucket
 */
export function groupRegistrantsByPaymentStatus(
  registrants: Array<{ 
    computed_payment_status?: string; 
    payment_status?: string;
    key?: string;
    person_id?: string;
    user_uid?: string;
  }>,
  attendees?: Array<{
    key?: string;
    person_id?: string;
    user_uid?: string;
    computed_payment_status?: string;
    payment_status?: string;
  }>
) {
  const buckets = {
    pending: 0,
    paid: 0,
    failed: 0,
    refund_requested: 0,
    refunded: 0,
    partially_refunded: 0,
  };

  registrants.forEach(registrant => {
    const status = resolveRegistrantPaymentStatus(registrant, attendees);
    const bucket = mapPaymentStatusToBucket(status);
    buckets[bucket]++;
  });

  return buckets;
}

/**
 * Resolves the payment status for a registrant, checking both direct status and enriched attendee data
 * @param registrant - The registrant object
 * @param attendees - Optional array of enriched attendee data
 * @returns The resolved payment status
 */
function resolveRegistrantPaymentStatus(
  registrant: {
    computed_payment_status?: string;
    payment_status?: string;
    key?: string;
    person_id?: string;
    user_uid?: string;
  },
  attendees?: Array<{
    key?: string;
    person_id?: string;
    user_uid?: string;
    computed_payment_status?: string;
    payment_status?: string;
  }>
): string | undefined {
  // First check if registrant already has payment status
  if (registrant.computed_payment_status) return registrant.computed_payment_status;
  if (registrant.payment_status) return registrant.payment_status;
  
  // Then look up in event attendees array (which has enriched data)
  if (!Array.isArray(attendees)) return undefined;
  
  const match = attendees.find(attendee => {
    try {
      // Match by key (most reliable)
      if (registrant.key && attendee?.key && String(attendee.key) === String(registrant.key)) return true;
      // Match by person_id for family members
      if (registrant.person_id && attendee?.person_id && String(attendee.person_id) === String(registrant.person_id)) return true;
      // Match user registrations (no person_id)
      if (!registrant.person_id && !attendee?.person_id && attendee?.user_uid === registrant.user_uid) return true;
    } catch (e) {
      console.warn('Error matching registrant to attendee:', e);
    }
    return false;
  });
  
  // Return computed status from enriched attendee data
  return match?.computed_payment_status || match?.payment_status;
}