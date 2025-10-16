/**
 * Helper functions for managing recurring events
 */

export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly" | "never";

/**
 * Calculate the next occurrence date for a recurring event
 */
export function calculateNextOccurrence(
  currentDate: string,
  recurrence: RecurrenceType
): Date | null {
  if (recurrence === "never") return null;

  const date = new Date(currentDate);
  if (isNaN(date.getTime())) return null;

  const nextDate = new Date(date);

  switch (recurrence) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return nextDate;
}

/**
 * Calculate multiple future occurrences
 */
export function calculateFutureOccurrences(
  currentDate: string,
  recurrence: RecurrenceType,
  count: number = 3
): Date[] {
  if (recurrence === "never" || count <= 0) return [];

  const occurrences: Date[] = [];
  let currentOccurrence = new Date(currentDate);

  for (let i = 0; i < count; i++) {
    const nextOccurrence = calculateNextOccurrence(
      currentOccurrence.toISOString(),
      recurrence
    );
    if (!nextOccurrence) break;

    occurrences.push(nextOccurrence);
    currentOccurrence = nextOccurrence;
  }

  return occurrences;
}

/**
 * Check if an event is past its current date
 */
export function isEventPast(eventDate: string): boolean {
  const now = new Date();
  const eventDateTime = new Date(eventDate);
  return eventDateTime < now;
}

/**
 * Format recurrence type for display
 */
export function formatRecurrenceType(recurrence: RecurrenceType): string {
  switch (recurrence) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    case "never":
      return "One-time";
    default:
      return "Unknown";
  }
}

/**
 * Get a human-readable description of when the next occurrence will be
 */
export function getNextOccurrenceDescription(
  currentDate: string,
  recurrence: RecurrenceType
): string {
  const nextDate = calculateNextOccurrence(currentDate, recurrence);
  if (!nextDate) return "No future occurrences";

  const now = new Date();
  const timeDiff = nextDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff === 1) return "Tomorrow";
  if (daysDiff === 7) return "Next week";
  if (daysDiff === 30 || daysDiff === 31) return "Next month";
  if (daysDiff >= 365) return "Next year";

  return `In ${daysDiff} days`;
}

/**
 * Prepare event data for updating to next occurrence
 * This updates the existing event rather than creating a new one
 * to preserve history and continuity. Returns complete event object
 * since backend PUT endpoint requires full event data.
 */
export function prepareEventUpdateForNextOccurrence(
  currentEvent: any,
  nextDate: Date
): any {
  // Return complete event object with updated date and reset fields
  // Strip image_url to just filename like EventsHelper does
  let processedImageUrl = ""
  if (currentEvent.image_url && currentEvent.image_url.trim()) {
    const parts = currentEvent.image_url.split("/")
    processedImageUrl = parts[parts.length - 1]
  }

  // Match the exact structure of the working handleEventEdit function
  return {
    name: currentEvent.name,
    ru_name: currentEvent.ru_name || "", // Ensure required field is present
    description: currentEvent.description,
    ru_description: currentEvent.ru_description || "", // Ensure required field is present
    date: nextDate.toISOString(),
    location: currentEvent.location,
    price: currentEvent.price,
    spots: currentEvent.spots,
    rsvp: currentEvent.rsvp,
    recurring: currentEvent.recurring,
    ministry: currentEvent.ministry,
    min_age: currentEvent.min_age,
    max_age: currentEvent.max_age,
    gender: currentEvent.gender,
    image_url: processedImageUrl || null, // Ensure Optional[str] compatibility
    roles: currentEvent.roles || [], // Ensure required field is present
    published: false, // Start as draft for review
    // Optional fields that have defaults in backend
    seats_taken: 0,
    attendee_keys: [],
    attendees: [],
    // Payment processing fields  
    payment_options: currentEvent.payment_options ?? [],
    refund_policy: currentEvent.refund_policy ?? null, // Use null instead of empty string
  };
}