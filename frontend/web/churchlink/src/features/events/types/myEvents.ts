export interface MyEvent {
  // Event reference schema fields (from my_events array)
  _id: string;                    // Local event reference ID
  event_id: string;               // Actual event ID
  person_id?: string;             // For family member events (ObjectId as string)
  reason: "rsvp" | "watch";       // Why user is tracking this event
  scope: "series" | "occurrence"; // Event scope
  series_id?: string;             // Optional series ID
  occurrence_id?: string;         // Optional occurrence ID  
  occurrence_start?: string;      // Optional occurrence start time
  key: string;                    // Unique composite key
  meta: Record<string, unknown>;      // Additional metadata
  addedOn: string;                // When user added this event

  // Full event details (when expand=True used)
  event?: {
    id: string;
    name: string;
    ru_name: string;
    description: string;
    ru_description: string;
    date: string;
    location: string;
    price: number;
    spots: number;
    rsvp: boolean;
    recurring: string;
    ministry: string[];
    min_age: number;
    max_age: number;
    gender: "all" | "male" | "female";
    image_url?: string;
    roles: string[];
    published: boolean;
    seats_taken: number;
    attendee_keys: string[];
    attendees: unknown[];
  };

  // Family member display name (if person_id exists)
  display_name?: string;
}

export type MyEventGroupedData = {
  totalRegistrants: number;
  allRegistrants: MyEvent[];
};

export type EventWithGroupedData = MyEvent & {
  groupedEventData?: MyEventGroupedData;
};

// Grouped event with all registrants
export interface GroupedEvent {
  event_id: string;
  event: MyEvent['event']; // The event details
  registrants: {
    user?: MyEvent; // User's own registration
    family: MyEvent[]; // Family member registrations
  };
  // Helper properties
  isUpcoming: boolean;
  eventDate: Date;
  allRegistrants: MyEvent[]; // Combined list for easy iteration
}

export interface MyEventsResponse {
  success: boolean;
  events: MyEvent[];
}

export interface EventFilters {
  showUpcoming: boolean;
  showPast: boolean;
  showFamily: boolean;
  searchTerm: string;
  ministry?: string;
}