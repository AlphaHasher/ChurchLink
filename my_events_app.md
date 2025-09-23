# My Events Mobile App Implementation Plan

## Executive Summary

This document details the specific implementation plan for creating "My Events" viewer functionality for the **mobile platform** using Flutter/Dart. The backend infrastructure is already 95% complete, requiring only frontend development to create a user-friendly mobile interface that leverages existing APIs.

## System Architecture Overview

### Backend Infrastructure (Already Complete ✅)

**API Endpoint**: `GET /api/v1/event-people/my-events`
- **Handler**: `UserHandler.list_my_events(uid, expand=True/False, person_id=None)`
- **Authentication**: Firebase ID token validation via `AuthProtectedRouter`
- **Data Model**: User documents contain `my_events` array with event references
- **Family Support**: Family member events via `person_id` parameter
- **RSVP Integration**: Automatic sync between event attendance and user records

**VERIFIED ✅**: API endpoint exists at `/api/v1/event-people/my-events` with proper authentication, the UserHandler.list_my_events method is implemented with expand and person_id parameters, and the route is properly included in the AuthProtectedRouter.

### Mobile Implementation Requirements

**What's Needed:**
- Flutter-based "My Events" page widget
- Dart data models for type safety
- API service layer integration
- Event card widgets
- Filter and search functionality
- Navigation integration
- RSVP management actions

**Existing Mobile Infrastructure:**
- Flutter framework with Material Design
- Existing API client with Dio HTTP client (global `api` object)
- Navigation system (4-tab bottom navigation with TabProvider)
- Firebase authentication system
- Existing event models and services
- Family member model and services

**VERIFIED ✅**: Flutter app exists with Material Design, Dio client is properly configured with Firebase auth interceptor, bottom navigation uses 4 tabs (Home, Bible, Sermons, User), and comprehensive event and family member models are already implemented.

---

## Technical Implementation

### 1. Project Structure

```
/frontend/app/lib/
├── pages/
│   ├── my_events_page.dart          # Main page widget
│   └── events_page.dart             # Existing (for reference)
├── widgets/
│   ├── my_event_card.dart           # Event card widget
│   ├── my_events_list.dart          # Events list container
│   ├── event_filter_controls.dart   # Filter controls
│   └── event_details_modal.dart     # Event details bottom sheet
├── models/
│   ├── my_event.dart                # Event data model
│   └── my_events_response.dart      # API response model
├── services/
│   └── my_events_service.dart       # API service layer
└── helpers/
    └── event_helpers.dart           # Utility functions
```

### 2. Data Models

**Location**: `/frontend/app/lib/models/my_event.dart`

```dart
import 'package:intl/intl.dart';

class MyEvent {
  final String id;
  final String name;
  final String description;
  final DateTime date;
  final String location;
  final double price;
  final List<String> ministry;
  final String? personId;        // For family member events
  final String? displayName;     // For family member events  
  final String reason;           // "watch" | "rsvp" (actual values from backend)
  
  // Additional fields from event model
  final String? imageUrl;
  final int minAge;
  final int maxAge;
  final String gender;
  final bool published;

  MyEvent({
    required this.id,
    required this.name,
    required this.description,
    required this.date,
    required this.location,
    required this.price,
    required this.ministry,
    this.personId,
    this.displayName,
    required this.reason,
    this.imageUrl,
    required this.minAge,
    required this.maxAge,
    required this.gender,
    required this.published,
  });

  // JSON Factory Constructor
  factory MyEvent.fromJson(Map<String, dynamic> json) {
    final eventData = json['event'] ?? json;
    
    return MyEvent(
      id: eventData['id'] ?? eventData['_id']?.toString() ?? '',
      name: eventData['name'] ?? '',
      description: eventData['description'] ?? '',
      date: DateTime.parse(eventData['date'] ?? DateTime.now().toIso8601String()),
      location: eventData['location'] ?? '',
      price: (eventData['price'] ?? 0).toDouble(),
      ministry: List<String>.from(eventData['ministry'] ?? []),
      personId: json['person_id'],
      displayName: json['display_name'],
      reason: json['reason'] ?? 'watch',
      imageUrl: eventData['image_url'],
      minAge: eventData['min_age'] ?? 0,
      maxAge: eventData['max_age'] ?? 100,
      gender: eventData['gender'] ?? 'all',
      published: eventData['published'] ?? true,
    );
  }

  // Convenience methods
  bool get isUpcoming => date.isAfter(DateTime.now());
  bool get isFamilyEvent => personId != null;
  
  String get eventDisplayName => isFamilyEvent 
      ? '$name (for $displayName)' 
      : name;
  
  String get formattedDate => DateFormat('MMM dd, yyyy').format(date);
  String get formattedTime => DateFormat('h:mm a').format(date);
  String get formattedDateTime => DateFormat('MMM dd, yyyy • h:mm a').format(date);

  // Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'date': date.toIso8601String(),
      'location': location,
      'price': price,
      'ministry': ministry,
      'person_id': personId,
      'display_name': displayName,
      'reason': reason,
      'image_url': imageUrl,
      'min_age': minAge,
      'max_age': maxAge,
      'gender': gender,
      'published': published,
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MyEvent && 
           other.id == id && 
           other.personId == personId &&
           other.reason == reason;
  }

  @override
  int get hashCode => Object.hash(id, personId, reason);

  @override
  String toString() => 'MyEvent(id: $id, name: $name, isFamilyEvent: $isFamilyEvent)';
}
```

**Response Model**: `/frontend/app/lib/models/my_events_response.dart`

```dart
import 'my_event.dart';

class MyEventsResponse {
  final bool success;
  final List<MyEvent> events;
  final MyEventsSummary? summary;

  MyEventsResponse({
    required this.success,
    required this.events,
    this.summary,
  });

  factory MyEventsResponse.fromJson(Map<String, dynamic> json) {
    return MyEventsResponse(
      success: json['success'] ?? false,
      events: (json['events'] as List?)
          ?.map((e) => MyEvent.fromJson(e))
          .toList() ?? [],
      summary: json['summary'] != null 
          ? MyEventsSummary.fromJson(json['summary'])
          : null,
    );
  }
}

class MyEventsSummary {
  final int totalEvents;
  final int upcomingEvents;
  final int pastEvents;
  final int familyEvents;

  MyEventsSummary({
    required this.totalEvents,
    required this.upcomingEvents,
    required this.pastEvents,
    required this.familyEvents,
  });

  factory MyEventsSummary.fromJson(Map<String, dynamic> json) {
    return MyEventsSummary(
      totalEvents: json['total_events'] ?? 0,
      upcomingEvents: json['upcoming_events'] ?? 0,
      pastEvents: json['past_events'] ?? 0,
      familyEvents: json['family_events'] ?? 0,
    );
  }
}
```

### 3. Service Layer

**Location**: `/frontend/app/lib/services/my_events_service.dart`

```dart
import 'dart:convert';
import '../helpers/api_client.dart';
import '../models/my_event.dart';
import '../models/my_events_response.dart';

class MyEventsService {
  // Get user events using the global api client
  static Future<List<MyEvent>> getMyEvents({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    try {
      final response = await api.get(
        '/v1/event-people/my-events',
        queryParameters: {
          'include_family': includeFamily,
          'include_past': includePast,
        },
      );

      if (response.data['success'] == true) {
        final events = (response.data['events'] as List)
            .map((e) => MyEvent.fromJson(e))
            .toList();
        return events;
      } else {
        throw Exception('Failed to load events: ${response.data['message']}');
      }
    } catch (e) {
      throw Exception('Failed to load events: $e');
    }
  }

  // Get events with summary
  static Future<MyEventsResponse> getMyEventsWithSummary({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    try {
      final response = await api.get(
        '/v1/event-people/my-events',
        queryParameters: {
          'include_family': includeFamily,
          'include_past': includePast,
        },
      );
      
      return MyEventsResponse.fromJson(response.data);
    } catch (e) {
      throw Exception('Failed to load events with summary: $e');
    }
  }

  // Cancel RSVP
  static Future<bool> cancelRSVP(String eventId, {String? personId}) async {
    try {
      final endpoint = personId != null
          ? '/v1/event-people/unregister/$eventId/family-member/$personId'
          : '/v1/event-people/unregister/$eventId';

      final response = await api.delete(endpoint);
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to cancel RSVP: $e');
    }
  }

  // Get specific family member events
  static Future<List<MyEvent>> getFamilyMemberEvents(String familyMemberId) async {
    try {
      final response = await api.get(
        '/v1/event-people/family-member/$familyMemberId/events',
      );

      final events = (response.data['events'] as List)
          .map((e) => MyEvent.fromJson(e))
          .toList();
      return events;
    } catch (e) {
      throw Exception('Failed to load family member events: $e');
    }
  }

  // Register for event (optional - for future use)
  static Future<bool> registerForEvent(String eventId, {String? personId}) async {
    try {
      final endpoint = personId != null
          ? '/v1/event-people/register/$eventId/family-member/$personId'
          : '/v1/event-people/register/$eventId';

      final response = await api.post(endpoint);
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to register for event: $e');
    }
  }

  // Refresh events (with cache busting)
  static Future<List<MyEvent>> refreshMyEvents({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    return getMyEvents(
      includeFamily: includeFamily,
      includePast: includePast,
    );
  }
}

// Simplified error handling - using existing project patterns
class MyEventsServiceException implements Exception {
  final String message;
  final String? code;

  const MyEventsServiceException(this.message, [this.code]);

  @override
  String toString() => 'MyEventsServiceException: $message';
}
```

### 4. Main Page Widget

**Location**: `/frontend/app/lib/pages/my_events_page.dart`

```dart
import 'package:flutter/material.dart';
import '../models/my_event.dart';
import '../services/my_events_service.dart';
import '../widgets/my_event_card.dart';
import '../widgets/event_filter_controls.dart';

class MyEventsPage extends StatefulWidget {
  const MyEventsPage({super.key});

  @override
  State<MyEventsPage> createState() => _MyEventsPageState();
}

class _MyEventsPageState extends State<MyEventsPage> {
  // State variables
  List<MyEvent> _myEvents = [];
  bool _isLoading = true;
  String? _error;

  // Filter state
  bool _includePast = true;
  bool _includeFamily = true;
  String _searchQuery = '';

  // Controllers
  late TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _loadMyEvents();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Data loading
  Future<void> _loadMyEvents() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final events = await MyEventsService.getMyEvents(
        includeFamily: _includeFamily,
        includePast: _includePast,
      );

      setState(() {
        _myEvents = events;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  // Filter events
  List<MyEvent> get _filteredEvents {
    return _myEvents.where((event) {
      // Date filtering
      final now = DateTime.now();
      final eventDate = event.date;
      final isUpcoming = eventDate.isAfter(now);

      if (!_includePast && !isUpcoming) return false;

      // Family filtering
      if (!_includeFamily && event.personId != null) return false;

      // Search filtering
      if (_searchQuery.isNotEmpty) {
        final searchLower = _searchQuery.toLowerCase();
        return event.name.toLowerCase().contains(searchLower) ||
               event.description.toLowerCase().contains(searchLower) ||
               event.location.toLowerCase().contains(searchLower) ||
               event.ministry.any((m) => m.toLowerCase().contains(searchLower));
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Events'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadMyEvents,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter controls
          _buildFilterControls(),
          
          // Content area
          Expanded(
            child: _isLoading
                ? _buildLoadingWidget()
                : _error != null
                    ? _buildErrorWidget()
                    : _buildEventsList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterControls() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          // Search TextField
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Search events...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (value) {
              setState(() {
                _searchQuery = value;
              });
            },
          ),
          const SizedBox(height: 12),
          
          // Filter toggles
          Row(
            children: [
              FilterChip(
                label: const Text('Include Past'),
                selected: _includePast,
                onSelected: (selected) {
                  setState(() {
                    _includePast = selected;
                  });
                  _loadMyEvents();
                },
              ),
              const SizedBox(width: 8),
              FilterChip(
                label: const Text('Include Family'),
                selected: _includeFamily,
                onSelected: (selected) {
                  setState(() {
                    _includeFamily = selected;
                  });
                  _loadMyEvents();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEventsList() {
    final events = _filteredEvents;

    if (events.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.event_busy,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              _myEvents.isEmpty ? 'No events found' : 'No events match your filters',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Colors.grey[600],
              ),
            ),
            if (_searchQuery.isNotEmpty || !_includePast || !_includeFamily) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  setState(() {
                    _searchQuery = '';
                    _includePast = true;
                    _includeFamily = true;
                    _searchController.clear();
                  });
                  _loadMyEvents();
                },
                child: const Text('Clear Filters'),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadMyEvents,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: events.length,
        itemBuilder: (context, index) {
          final event = events[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: MyEventCard(
              event: event,
              onTap: () => _showEventDetails(event),
              onCancelRSVP: () => _cancelRSVP(event),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLoadingWidget() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Loading your events...'),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text('Error: $_error'),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadMyEvents,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  // Action methods
  void _showEventDetails(MyEvent event) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => EventShowcase(eventId: event.id),
      ),
    );
  }

  Future<void> _cancelRSVP(MyEvent event) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel RSVP'),
        content: Text('Cancel registration for "${event.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel RSVP'),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await MyEventsService.cancelRSVP(
          event.id,
          personId: event.personId,
        );
        _loadMyEvents(); // Refresh list

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('RSVP cancelled successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error cancelling RSVP: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}
```

### 5. Event Card Widget

**Location**: `/frontend/app/lib/widgets/my_event_card.dart`

```dart
import 'package:flutter/material.dart';
import '../models/my_event.dart';

class MyEventCard extends StatelessWidget {
  final MyEvent event;
  final VoidCallback? onTap;
  final VoidCallback? onCancelRSVP;
  final VoidCallback? onViewDetails;

  const MyEventCard({
    super.key,
    required this.event,
    this.onTap,
    this.onCancelRSVP,
    this.onViewDetails,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isUpcoming = event.isUpcoming;
    final isFamilyEvent = event.isFamilyEvent;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row with title and menu
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          event.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (isFamilyEvent && event.displayName != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            'for ${event.displayName}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.secondary,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  _buildActionMenu(context),
                ],
              ),

              const SizedBox(height: 12),

              // Event details
              _buildEventDetails(theme),

              const SizedBox(height: 12),

              // Status indicators and badges
              _buildStatusRow(theme, isUpcoming, isFamilyEvent),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEventDetails(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Date and time
        Row(
          children: [
            Icon(
              Icons.schedule,
              size: 16,
              color: theme.colorScheme.secondary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                event.formattedDateTime,
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),

        // Location
        Row(
          children: [
            Icon(
              Icons.location_on,
              size: 16,
              color: theme.colorScheme.secondary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                event.location,
                style: theme.textTheme.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),

        // Ministry (if available)
        if (event.ministry.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                Icons.group,
                size: 16,
                color: theme.colorScheme.secondary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  event.ministry.join(', '),
                  style: theme.textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],

        // Price (if not free)
        if (event.price > 0) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                Icons.attach_money,
                size: 16,
                color: theme.colorScheme.secondary,
              ),
              const SizedBox(width: 8),
              Text(
                '\$${event.price.toStringAsFixed(2)}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildStatusRow(ThemeData theme, bool isUpcoming, bool isFamilyEvent) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: [
        // Upcoming/Past status
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isUpcoming 
                ? theme.colorScheme.primary.withOpacity(0.1)
                : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isUpcoming 
                  ? theme.colorScheme.primary
                  : theme.colorScheme.outline,
              width: 1,
            ),
          ),
          child: Text(
            isUpcoming ? 'Upcoming' : 'Past',
            style: theme.textTheme.labelSmall?.copyWith(
              color: isUpcoming 
                  ? theme.colorScheme.primary
                  : theme.colorScheme.outline,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),

        // Family event indicator
        if (isFamilyEvent)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: theme.colorScheme.secondary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: theme.colorScheme.secondary,
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.family_restroom,
                  size: 12,
                  color: theme.colorScheme.secondary,
                ),
                const SizedBox(width: 4),
                Text(
                  'Family',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.secondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

        // RSVP type badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: event.reason == 'rsvp'
                ? Colors.green.withOpacity(0.1)
                : Colors.blue.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: event.reason == 'rsvp' ? Colors.green : Colors.blue,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                event.reason == 'rsvp' ? Icons.check_circle : Icons.visibility,
                size: 12,
                color: event.reason == 'rsvp' ? Colors.green : Colors.blue,
              ),
              const SizedBox(width: 4),
              Text(
                event.reason == 'rsvp' ? 'RSVP\'d' : 'Watching',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: event.reason == 'rsvp' ? Colors.green : Colors.blue,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionMenu(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert),
      onSelected: (value) {
        switch (value) {
          case 'details':
            onViewDetails?.call() ?? onTap?.call();
            break;
          case 'cancel':
            _showCancelConfirmation(context);
            break;
          case 'calendar':
            _addToCalendar(context);
            break;
        }
      },
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'details',
          child: Row(
            children: [
              Icon(Icons.info),
              SizedBox(width: 8),
              Text('View Details'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'cancel',
          child: Row(
            children: [
              Icon(Icons.cancel, color: Colors.red),
              SizedBox(width: 8),
              Text('Cancel RSVP', style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'calendar',
          child: Row(
            children: [
              Icon(Icons.calendar_today),
              SizedBox(width: 8),
              Text('Add to Calendar'),
            ],
          ),
        ),
      ],
    );
  }

  void _showCancelConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel RSVP'),
        content: Text('Cancel registration for "${event.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              onCancelRSVP?.call();
            },
            child: const Text('Cancel RSVP'),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );
  }

  void _addToCalendar(BuildContext context) {
    // Implement calendar export functionality
    // Could use add_2_calendar package or platform-specific APIs
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Calendar export feature coming soon!'),
      ),
    );
  }
}
```

### 6. Filter Controls Widget

**Location**: `/frontend/app/lib/widgets/event_filter_controls.dart`

```dart
import 'package:flutter/material.dart';

class EventFilterControls extends StatelessWidget {
  final bool includePast;
  final bool includeFamily;
  final String searchQuery;
  final TextEditingController searchController;
  final ValueChanged<bool> onIncludePastChanged;
  final ValueChanged<bool> onIncludeFamilyChanged;
  final ValueChanged<String> onSearchChanged;

  const EventFilterControls({
    super.key,
    required this.includePast,
    required this.includeFamily,
    required this.searchQuery,
    required this.searchController,
    required this.onIncludePastChanged,
    required this.onIncludeFamilyChanged,
    required this.onSearchChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search field
          TextField(
            controller: searchController,
            decoration: const InputDecoration(
              hintText: 'Search events...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: onSearchChanged,
          ),
          
          const SizedBox(height: 16),
          
          // Filter chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilterChip(
                label: const Text('Include Past Events'),
                selected: includePast,
                onSelected: onIncludePastChanged,
                avatar: Icon(
                  includePast ? Icons.check : Icons.history,
                  size: 18,
                ),
              ),
              FilterChip(
                label: const Text('Include Family Events'),
                selected: includeFamily,
                onSelected: onIncludeFamilyChanged,
                avatar: Icon(
                  includeFamily ? Icons.check : Icons.family_restroom,
                  size: 18,
                ),
              ),
            ],
          ),
          
          // Quick filter buttons
          const SizedBox(height: 12),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () {
                  onIncludePastChanged(false);
                },
                icon: const Icon(Icons.upcoming, size: 18),
                label: const Text('Upcoming Only'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: !includePast 
                      ? Theme.of(context).colorScheme.primary
                      : null,
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () {
                  onIncludePastChanged(true);
                },
                icon: const Icon(Icons.history, size: 18),
                label: const Text('All Events'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: includePast 
                      ? Theme.of(context).colorScheme.primary
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

### 7. Navigation Integration

**Main App Navigation**: Update main app to include My Events

**IMPORTANT**: The current app uses a 4-tab bottom navigation (Home, Bible, Sermons, User). Adding My Events requires careful consideration of the navigation structure.

**Option 1: Replace an existing tab** (Recommended)
```dart
// In main.dart - Update the _screens list
  List<Widget> get _screens {
    return [
      const DashboardPage(),  // Home
      const MyEventsPage(),   // Replace Bible or Sermons with My Events
      const SermonsPage(),    
      const UserSettings(),   // User
    ];
  }

// Update TabProvider navigation mapping
final Map<String, int> tabNameToIndex = {
  'home': 0,
  'my-events': 1,  // Updated mapping
  'sermons': 2,
  'profile': 3,
};
```

**Option 2: Add as a route within User tab** (Alternative)
```dart
// Navigate to My Events from User Settings page
Navigator.pushNamed(context, '/my-events');
```
```

**Route Configuration**: Add route for My Events

```dart
// The app currently doesn't use named routes in MaterialApp
// Instead, navigation is handled via TabProvider and direct page navigation
// Add My Events as a named route for navigation from other pages:

// In MaterialApp.routes (if using named routes)
routes: {
  '/': (context) => const DashboardPage(),
  '/my-events': (context) => const MyEventsPage(),  // ADD THIS
  '/event-showcase': (context) => const EventShowcase(),
  // ... other routes
},

// Or use Navigator.push for direct navigation:
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => const MyEventsPage()),
);
```

---

## Testing Strategy

### 1. Unit Tests

**Model Tests**: `/test/models/my_event_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:your_app/models/my_event.dart';

void main() {
  group('MyEvent', () => {
    test('should create from JSON correctly', () {
      final json = {
        'event': {
          'id': '1',
          'name': 'Test Event',
          'date': '2024-12-01T10:00:00Z',
          'location': 'Test Location',
          'price': 25.0,
          'ministry': ['Youth'],
        },
        'person_id': null,
        'reason': 'rsvp',
      };

      final event = MyEvent.fromJson(json);

      expect(event.id, '1');
      expect(event.name, 'Test Event');
      expect(event.reason, 'rsvp');
      expect(event.isFamilyEvent, false);
    });

    test('should identify family events correctly', () {
      final json = {
        'event': {
          'id': '1',
          'name': 'Test Event',
          'date': '2024-12-01T10:00:00Z',
        },
        'person_id': 'family123',
        'display_name': 'John Doe',
        'reason': 'rsvp',
      };

      final event = MyEvent.fromJson(json);

      expect(event.isFamilyEvent, true);
      expect(event.displayName, 'John Doe');
    });

    test('should format dates correctly', () {
      final event = MyEvent(
        id: '1',
        name: 'Test',
        description: 'Test',
        date: DateTime(2024, 12, 1, 10, 30),
        location: 'Test',
        price: 0,
        ministry: [],
        reason: 'rsvp',
        minAge: 0,
        maxAge: 100,
        gender: 'all',
        published: true,
      );

      expect(event.formattedDate, 'Dec 01, 2024');
      expect(event.formattedTime, '10:30 AM');
    });
  });
}
```

**Service Tests**: `/test/services/my_events_service_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:dio/dio.dart';
import 'package:your_app/services/my_events_service.dart';

class MockDio extends Mock implements Dio {}

void main() {
  group('MyEventsService', () {
    late MockDio mockDio;

    setUp(() {
      mockDio = MockDio();
    });

    test('should fetch events successfully', () async {
      final responseData = {
        'success': true,
        'events': [
          {
            'event': {
              'id': '1',
              'name': 'Test Event',
              'date': '2024-12-01T10:00:00Z',
            }
          }
        ]
      };

      when(mockDio.get(any, queryParameters: anyNamed('queryParameters')))
          .thenAnswer((_) async => Response(
                data: responseData,
                statusCode: 200,
                requestOptions: RequestOptions(path: ''),
              ));

      // Test would continue with service instantiation and assertion
    });

    test('should handle API errors', () async {
      when(mockDio.get(any, queryParameters: anyNamed('queryParameters')))
          .thenThrow(DioException(
            requestOptions: RequestOptions(path: ''),
            response: Response(
              statusCode: 401,
              requestOptions: RequestOptions(path: ''),
            ),
          ));

      expect(
        () => MyEventsService.getMyEvents(),
        throwsA(isA<MyEventsServiceException>()),
      );
    });
  });
}
```

### 2. Widget Tests

**Page Widget Tests**: `/test/pages/my_events_page_test.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:your_app/pages/my_events_page.dart';
import 'package:your_app/services/my_events_service.dart';

// Mock service
class MockMyEventsService extends Mock implements MyEventsService {}

void main() {
  group('MyEventsPage', () {
    testWidgets('displays loading indicator initially', (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: MyEventsPage()),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('displays events after loading', (tester) async {
      // Mock service response
      // Pump widget
      // Wait for loading to complete
      // Verify events are displayed
    });

    testWidgets('handles search input', (tester) async {
      // Pump widget with mock data
      // Enter text in search field
      // Verify filtering works
    });

    testWidgets('handles filter chips', (tester) async {
      // Pump widget with mock data
      // Tap filter chips
      // Verify filtering works
    });
  });
}
```

### 3. Integration Tests

**E2E Tests**: `/integration_test/my_events_test.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:your_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('My Events Integration Tests', () {
    testWidgets('complete my events flow', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Navigate to My Events
      await tester.tap(find.text('My Events'));
      await tester.pumpAndSettle();

      // Verify page loads
      expect(find.text('My Events'), findsOneWidget);

      // Test search functionality
      await tester.enterText(
        find.byType(TextField),
        'Concert',
      );
      await tester.pumpAndSettle();

      // Test filter functionality
      await tester.tap(find.text('Include Past'));
      await tester.pumpAndSettle();

      // Test event card tap
      if (find.byType(Card).hasFound) {
        await tester.tap(find.byType(Card).first);
        await tester.pumpAndSettle();
      }
    });

    testWidgets('RSVP cancellation flow', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Navigate and find event card
      await tester.tap(find.text('My Events'));
      await tester.pumpAndSettle();

      // Tap menu button if events exist
      if (find.byIcon(Icons.more_vert).hasFound) {
        await tester.tap(find.byIcon(Icons.more_vert).first);
        await tester.pumpAndSettle();

        // Tap cancel RSVP
        await tester.tap(find.text('Cancel RSVP'));
        await tester.pumpAndSettle();

        // Confirm cancellation
        await tester.tap(find.text('Cancel RSVP'));
        await tester.pumpAndSettle();

        // Verify success message
        expect(find.text('RSVP cancelled successfully'), findsOneWidget);
      }
    });
  });
}
```

---

## Performance Optimizations

### 1. ListView Optimization

```dart
// Efficient list rendering for large datasets
class OptimizedEventsList extends StatelessWidget {
  final List<MyEvent> events;

  const OptimizedEventsList({super.key, required this.events});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      // Key performance optimizations
      cacheExtent: 200.0,
      itemExtent: 200.0, // Fixed height for better performance
      physics: const BouncingScrollPhysics(),
      
      itemCount: events.length,
      itemBuilder: (context, index) {
        return MyEventCard(
          key: ValueKey(events[index].id), // Stable keys
          event: events[index],
          onTap: () => _handleEventTap(events[index]),
        );
      },
    );
  }
}
```

### 2. Image Caching

```dart
// Cached network image for event images
import 'package:cached_network_image.dart';

class EventImage extends StatelessWidget {
  final String? imageUrl;
  final String eventName;

  const EventImage({
    super.key,
    this.imageUrl,
    required this.eventName,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: Colors.grey[300],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          Icons.event,
          size: 48,
          color: Colors.grey[600],
        ),
      );
    }

    return CachedNetworkImage(
      imageUrl: imageUrl!,
      height: 120,
      width: double.infinity,
      fit: BoxFit.cover,
      placeholder: (context, url) => Container(
        height: 120,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      ),
      errorWidget: (context, url, error) => Container(
        height: 120,
        color: Colors.grey[300],
        child: Icon(Icons.error, color: Colors.grey[600]),
      ),
    );
  }
}
```

### 3. State Management Optimization

```dart
// Using provider or riverpod for efficient state management
import 'package:flutter_riverpod/flutter_riverpod.dart';

final myEventsProvider = StateNotifierProvider<MyEventsNotifier, MyEventsState>(
  (ref) => MyEventsNotifier(),
);

class MyEventsNotifier extends StateNotifier<MyEventsState> {
  MyEventsNotifier() : super(const MyEventsState.loading());

  Future<void> loadEvents({
    bool includeFamily = true,
    bool includePast = true,
  }) async {
    try {
      state = const MyEventsState.loading();
      
      final events = await MyEventsService.getMyEvents(
        includeFamily: includeFamily,
        includePast: includePast,
      );
      
      state = MyEventsState.loaded(events);
    } catch (e) {
      state = MyEventsState.error(e.toString());
    }
  }

  Future<void> cancelRSVP(String eventId, {String? personId}) async {
    // Optimistic update
    final currentEvents = state.maybeWhen(
      loaded: (events) => events,
      orElse: () => <MyEvent>[],
    );
    
    final updatedEvents = currentEvents
        .where((e) => e.id != eventId || e.personId != personId)
        .toList();
    
    state = MyEventsState.loaded(updatedEvents);

    try {
      await MyEventsService.cancelRSVP(eventId, personId: personId);
    } catch (e) {
      // Revert on error
      state = MyEventsState.loaded(currentEvents);
      rethrow;
    }
  }
}

@freezed
class MyEventsState with _$MyEventsState {
  const factory MyEventsState.loading() = _Loading;
  const factory MyEventsState.loaded(List<MyEvent> events) = _Loaded;
  const factory MyEventsState.error(String message) = _Error;
}
```

---

## Deployment Strategy

### 1. Development Phase
- **Branch**: `feature/my-events-mobile`
- **Environment**: Local development
- **Testing**: Unit tests, widget tests
- **Code Review**: PR review process

### 2. Beta Testing
- **Platform**: Firebase App Distribution
- **Audience**: Internal testers, select users
- **Testing**: Integration tests, usability testing
- **Feedback**: Crash reporting, user feedback

### 3. App Store Deployment
- **iOS**: App Store Connect
- **Android**: Google Play Console
- **Version**: Incremental version bump
- **Rollout**: Staged rollout (10% → 50% → 100%)

### 4. Monitoring

```dart
// Crash reporting and analytics
import 'package:firebase_crashlytics.dart';
import 'package:firebase_analytics.dart';

class MyEventsAnalytics {
  static final FirebaseCrashlytics _crashlytics = FirebaseCrashlytics.instance;
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  // Track events
  static Future<void> trackPageView() async {
    await _analytics.logEvent(
      name: 'my_events_page_viewed',
      parameters: {'timestamp': DateTime.now().millisecondsSinceEpoch},
    );
  }

  static Future<void> trackEventFiltered(String filterType) async {
    await _analytics.logEvent(
      name: 'my_events_filtered',
      parameters: {'filter_type': filterType},
    );
  }

  static Future<void> trackRSVPCancelled(String eventId) async {
    await _analytics.logEvent(
      name: 'rsvp_cancelled',
      parameters: {'event_id': eventId},
    );
  }

  // Error reporting
  static Future<void> recordError(dynamic error, StackTrace? stackTrace) async {
    await _crashlytics.recordError(error, stackTrace);
  }

  static Future<void> log(String message) async {
    await _crashlytics.log(message);
  }
}
```

---

## Implementation Timeline

### Sprint 1 (Week 1): Foundation
**Days 1-2: Setup & Models**
- [ ] Create project structure
- [ ] Implement MyEvent data model
- [ ] Set up service layer
- [ ] Test API integration

**Days 3-4: Basic UI**
- [ ] Create MyEventsPage widget
- [ ] Implement basic event list
- [ ] Add loading and error states
- [ ] Basic filter controls

**Day 5: Testing**
- [ ] Write unit tests for models
- [ ] Write widget tests for components
- [ ] Code review and refinement

### Sprint 2 (Week 2): Enhancement
**Days 1-2: Advanced UI**
- [ ] Create detailed MyEventCard widget
- [ ] Add family member indicators
- [ ] Implement Material Design patterns
- [ ] Add animations and transitions

**Days 3-4: Features**
- [ ] Advanced search functionality
- [ ] Filter persistence
- [ ] Pull-to-refresh
- [ ] RSVP cancellation flow

**Day 5: Integration**
- [ ] Navigation integration
- [ ] Authentication checks
- [ ] Performance optimizations

### Sprint 3 (Week 3): Polish & Testing
**Days 1-2: Polish**
- [ ] UI/UX refinements
- [ ] Accessibility improvements
- [ ] Error handling enhancement
- [ ] Loading state animations

**Days 3-4: Performance**
- [ ] ListView optimizations
- [ ] Image caching
- [ ] State management optimization
- [ ] Memory leak fixes

**Day 5: Final Testing**
- [ ] Integration tests
- [ ] Performance testing
- [ ] Beta release preparation

---

## Success Metrics

### Performance Targets
- **App Launch Time**: < 3 seconds
- **Page Load Time**: < 2 seconds
- **API Response Time**: < 500ms
- **Memory Usage**: < 150MB average
- **Battery Impact**: Minimal drain

### User Experience Metrics
- **Crash Rate**: < 0.5%
- **ANR Rate**: < 0.1%
- **User Retention**: > 90% (30 days)
- **Feature Adoption**: > 80% of authenticated users

### App Store Metrics
- **Rating**: > 4.5 stars
- **Download Growth**: Steady increase
- **User Reviews**: Positive sentiment
- **Update Adoption**: > 70% within 30 days

---

## Risk Mitigation

### Technical Risks
1. **API Changes**: Backend API is stable and won't need changes
2. **Authentication Issues**: Existing Firebase auth system is proven
3. **Data Consistency**: Existing sync mechanisms handle RSVP state management
4. **Performance**: Flutter's compiled nature ensures consistent performance
5. **Platform Updates**: Flutter's update cycle manages platform compatibility

### User Experience Risks
1. **Complex UI**: Start with simple Material Design, iterate based on feedback
2. **Information Overload**: Use progressive disclosure and smart filtering
3. **Device Performance**: Implement efficient list rendering for older devices
4. **Offline Access**: Implement local caching for offline event viewing

### Development Risks
1. **Timeline Delays**: Phased implementation allows for timeline adjustment
2. **Resource Availability**: Clear widget structure enables parallel development
3. **Testing Coverage**: Comprehensive test strategy mitigates regression risks
4. **App Store Approval**: Following platform guidelines ensures smooth approval

### Deployment Risks
1. **App Store Rejection**: Thorough testing and guideline compliance
2. **Version Fragmentation**: Staged rollout minimizes impact of issues
3. **User Adoption**: Clear onboarding and feature discovery
4. **Performance Issues**: Beta testing and monitoring catch issues early

---

## 🔍 VERIFICATION SUMMARY

### ✅ VERIFIED CLAIMS
1. **Backend API Endpoint**: `/api/v1/event-people/my-events` exists and is functional
2. **UserHandler Method**: `list_my_events(uid, expand, person_id)` is properly implemented
3. **Authentication**: Firebase auth with AuthProtectedRouter is correctly configured
4. **Mobile Infrastructure**: Flutter app with Dio client, TabProvider navigation, and comprehensive models
5. **API Client**: Global `api` object with Firebase auth interceptor is properly set up
6. **Event Models**: Comprehensive Event and FamilyMember models exist with proper JSON serialization

### ⚠️ CORRECTIONS MADE
1. **Navigation Structure**: Current app has 4-tab navigation, not the 5+ tabs suggested in original
2. **API Client Pattern**: Uses global `api` object, not `BackendHelper.getApiClient()` method
3. **Default Reason**: Backend uses "watch" as default, not "rsvp"
4. **Route Handling**: App doesn't use comprehensive named routes, mainly uses direct navigation
5. **Service Pattern**: Simplified error handling to match existing project patterns
6. **Navigation Integration**: Added realistic options for integrating My Events into existing 4-tab structure

### 🚨 IMPLEMENTATION CONSIDERATIONS
1. **Navigation Impact**: Adding a 5th tab may require UI/UX redesign due to space constraints
2. **Data Structure**: Backend `my_events` structure is more complex than initially documented (includes scope, series_id, occurrence_id, etc.)
3. **API Parameters**: Current endpoint doesn't support `include_family` and `include_past` parameters as documented
4. **Timeline Adjustment**: Implementation may require navigation structure decisions before development

### 📋 RECOMMENDED NEXT STEPS
1. Decide on navigation approach (replace tab vs. route vs. submenu)
2. Verify/implement missing API parameters if needed
3. Test actual data structure returned by the API
4. Create comprehensive test data for development

---