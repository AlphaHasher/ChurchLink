import '../helpers/api_client.dart';
import '../models/my_events.dart';

class MyEventsService {
  /// Fetch user's events with optional family inclusion and expansion
  /// When expand=true, full event details are included in the response
  /// When includeFamily=true, family member registrations are included
  static Future<MyEventsResponse> getMyEvents({
    bool includeFamily = true,
    bool expand = true,
  }) async {
    try {
      final response = await api.get(
        '/v1/event-people/my-events',
        queryParameters: {
          'include_family': includeFamily ? 'true' : 'false',
          'expand': expand ? 'true' : 'false',
        },
      );

      if (response.data is Map<String, dynamic>) {
        return MyEventsResponse.fromJson(response.data as Map<String, dynamic>);
      }

      // If response format is unexpected, return empty success response
      return MyEventsResponse(success: false, events: []);
    } catch (e) {
      throw Exception('Failed to fetch my events: $e');
    }
  }

  /// Cancel RSVP for user or family member
  /// If personId is null, cancels user's own RSVP
  /// If personId is provided, cancels family member's RSVP
  static Future<bool> cancelRsvp({
    required String eventId,
    String? personId,
  }) async {
    try {
      final String endpoint;

      if (personId != null) {
        // Cancel family member's RSVP
        endpoint =
            '/v1/event-people/unregister/$eventId/family-member/$personId';
      } else {
        // Cancel user's own RSVP
        endpoint = '/v1/event-people/unregister/$eventId';
      }

      final response = await api.delete(endpoint);

      // Return true if the response indicates success
      if (response.data is Map<String, dynamic>) {
        return response.data['success'] == true;
      }

      // Consider successful if we get a 2xx status code even without success field
      return response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300;
    } catch (e) {
      throw Exception('Failed to cancel RSVP: $e');
    }
  }

  /// Helper method to filter events based on criteria
  static List<MyEventRef> filterEvents(
    List<MyEventRef> events,
    EventFilters filters,
  ) {
    return events.where((eventRef) {
      // If the event details are missing (non-expanded), treat this as a
      // placeholder item. We still allow it to appear in the list unless a
      // filter explicitly requires event content (search/ministry). Family
      // filtering still applies because `personId` is available on the
      // registration.
      final event = eventRef.event;

      // Filter by family (works even when event == null)
      if (!filters.showFamily && eventRef.isFamilyMember) return false;

      // If we don't have expanded event details, we can't evaluate time or
      // content-based filters. For usability show placeholders unless a
      // content-based filter is active that they cannot satisfy.
      if (event == null) {
        // If there's a search term or a specific ministry filter, the
        // placeholder cannot match content; exclude it.
        if (filters.searchTerm.isNotEmpty) return false;
        if (filters.ministry != null && filters.ministry!.isNotEmpty)
          return false;

        // Otherwise include the placeholder item.
        return true;
      }

      final isUpcoming = event.date.isAfter(DateTime.now());

      // Filter by time (upcoming/past) - mutually exclusive
      if (filters.timeFilter == TimeFilter.upcoming && !isUpcoming)
        return false;
      if (filters.timeFilter == TimeFilter.past && isUpcoming) return false;

      // Filter by search term against event fields
      if (filters.searchTerm.isNotEmpty) {
        final searchTerm = filters.searchTerm.toLowerCase();
        final matchesName = event.name.toLowerCase().contains(searchTerm);
        final matchesDescription = event.description.toLowerCase().contains(
          searchTerm,
        );
        final matchesLocation = event.location.toLowerCase().contains(
          searchTerm,
        );
        final matchesMinistry = event.ministry.any(
          (m) => m.toLowerCase().contains(searchTerm),
        );

        if (!matchesName &&
            !matchesDescription &&
            !matchesLocation &&
            !matchesMinistry) {
          return false;
        }
      }

      // Filter by specific ministry
      if (filters.ministry != null && filters.ministry!.isNotEmpty) {
        if (!event.ministry.contains(filters.ministry)) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  /// Deduplicate events by composite key as mentioned in the todo.md
  /// Uses event_id + person_id for family members, event_id + "user" for user
  static List<MyEventRef> deduplicateEvents(List<MyEventRef> events) {
    // Group events by eventId and aggregate registrant display names so a single
    // card represents the event with a list of registrants (user + family).
    final Map<String, MyEventRef> grouped = {};

    for (final eventRef in events) {
      final eventKey = eventRef.eventId;

      if (!grouped.containsKey(eventKey)) {
        // Clone the eventRef but initialize registrants with current displayName
        // Determine initial registrant name: prefer displayName, else 'You' for user's own registration
        String? initialName = eventRef.displayName;
        if ((initialName == null || initialName.isEmpty) &&
            eventRef.personId == null) {
          initialName = 'You';
        }

        grouped[eventKey] = MyEventRef(
          id: eventRef.id,
          eventId: eventRef.eventId,
          personId: eventRef.personId,
          reason: eventRef.reason,
          scope: eventRef.scope,
          seriesId: eventRef.seriesId,
          occurrenceId: eventRef.occurrenceId,
          occurrenceStart: eventRef.occurrenceStart,
          key: eventRef.key,
          meta: eventRef.meta,
          addedOn: eventRef.addedOn,
          displayName: eventRef.displayName,
          event: eventRef.event,
          registrants:
              initialName != null && initialName.isNotEmpty
                  ? <String>[initialName]
                  : <String>[],
        );
      } else {
        // Append registrant display name if it's a family member and not present
        final existing = grouped[eventKey]!;
        String? name = eventRef.displayName;
        if ((name == null || name.isEmpty) && eventRef.personId == null) {
          name = 'You';
        }
        if (name != null &&
            name.isNotEmpty &&
            !existing.registrants.contains(name)) {
          existing.registrants.add(name);
        }
      }
    }

    return grouped.values.toList();
  }
}
