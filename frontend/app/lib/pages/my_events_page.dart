import 'package:flutter/material.dart';
import 'package:app/models/my_events.dart';
import 'package:app/services/my_events_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/pages/event_showcase.dart';
import 'package:app/models/event.dart' as event_model;
import 'package:app/widgets/event_card.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:open_filex/open_filex.dart';
import 'package:android_intent_plus/android_intent.dart';

class MyEventsPage extends StatefulWidget {
  const MyEventsPage({super.key});

  @override
  State<MyEventsPage> createState() => _MyEventsPageState();
}

class _MyEventsPageState extends State<MyEventsPage> {
  List<MyEventRef> _allEvents = [];
  List<MyEventRef> _filteredEvents = [];
  bool _isLoading = true;
  String? _errorMessage;

  EventFilters _filters = EventFilters();
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadEvents();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {
      _filters = _filters.copyWith(searchTerm: _searchController.text);
      _applyFilters();
    });
  }

  Future<void> _loadEvents() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await MyEventsService.getMyEvents(
        includeFamily: true,
        expand: true,
      );

      if (!mounted) return;

      if (response.success) {
        setState(() {
          _allEvents = MyEventsService.deduplicateEvents(response.events);
          _applyFilters();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to load events';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error loading events: ${e.toString()}';
          _isLoading = false;
        });
      }
    }
  }

  void _applyFilters() {
    _filteredEvents = MyEventsService.filterEvents(_allEvents, _filters);
  }

  Future<void> _cancelRsvp(MyEventRef eventRef) async {
    try {
      // Show loading indicator
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      final success = await MyEventsService.cancelRsvp(
        eventId: eventRef.eventId,
        personId: eventRef.personId,
      );

      // Close loading indicator
      if (mounted) Navigator.of(context).pop();

      if (success) {
        // Show success message
        if (mounted) {
          final theme = Theme.of(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                eventRef.isFamilyMember
                    ? 'RSVP cancelled for ${eventRef.effectiveDisplayName}'
                    : 'Your RSVP has been cancelled',
              ),
              backgroundColor: theme.colorScheme.primary,
            ),
          );
        }

        // Refresh the events list
        if (mounted) {
          _loadEvents();
        }
      } else {
        if (mounted) {
          final theme = Theme.of(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Failed to cancel RSVP'),
              backgroundColor: theme.colorScheme.error,
            ),
          );
        }
      }
    } catch (e) {
      // Close loading indicator if still showing
      if (mounted) Navigator.of(context).pop();

      if (mounted) {
        final theme = Theme.of(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Events'), centerTitle: true),
      body: Column(
        children: [
          // Filter Controls
          _buildFilterControls(),

          // Content Area
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadEvents,
              child: _buildContent(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterControls() {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            spreadRadius: 0,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Search Field
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search events...',
              prefixIcon: Icon(Icons.search, color: theme.colorScheme.primary),
              border: const OutlineInputBorder(borderRadius: BorderRadius.zero),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 8,
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Filter Switches
          Row(
            children: [
              Expanded(
                child: _buildFilterChip(
                  label: 'Show Upcoming',
                  isSelected: _filters.showUpcoming,
                  onTap:
                      () => setState(() {
                        _filters = _filters.copyWith(
                          timeFilter: TimeFilter.upcoming,
                        );
                        _applyFilters();
                      }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildFilterChip(
                  label: 'Show Past',
                  isSelected: _filters.showPast,
                  onTap:
                      () => setState(() {
                        _filters = _filters.copyWith(
                          timeFilter: TimeFilter.past,
                        );
                        _applyFilters();
                      }),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color:
              isSelected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                isSelected
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outline.withValues(alpha: 0.3),
            width: 2,
          ),
          boxShadow:
              isSelected
                  ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 8,
                      spreadRadius: 0,
                      offset: const Offset(0, 3),
                    ),
                  ]
                  : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 4,
                      spreadRadius: 0,
                      offset: const Offset(0, 1),
                    ),
                  ],
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color:
                isSelected
                    ? theme.colorScheme.onPrimary
                    : theme.colorScheme.onSurface,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      final theme = Theme.of(context);
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: TextStyle(
                fontSize: 16,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadEvents,
              style: ElevatedButton.styleFrom(
                backgroundColor: theme.colorScheme.primary,
                foregroundColor: theme.colorScheme.onPrimary,
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 24,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_filteredEvents.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      itemCount: _filteredEvents.length,
      itemBuilder: (context, index) {
        final eventRef = _filteredEvents[index];
        return Stack(
          clipBehavior: Clip.none,
          children: [
            EventCard(
              eventRef: eventRef,
              onViewPressed: () async {
                final navigator = Navigator.of(context);
                try {
                  final user = FirebaseAuth.instance.currentUser;
                  if (user != null) {
                    await user.getIdToken();
                  }
                } catch (_) {}
                if (!mounted) return;

                final d = eventRef.event;
                if (d == null) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Event details could not be loaded. Please try again later.',
                      ),
                    ),
                  );
                  return;
                }

                final evt = event_model.Event(
                  id: d.id.isNotEmpty ? d.id : eventRef.eventId,
                  name: d.name,
                  ruName: d.ruName,
                  description: d.description,
                  ruDescription: d.ruDescription,
                  date: d.date,
                  location: d.location,
                  price: d.price,
                  ministry: d.ministry,
                  minAge: d.minAge,
                  maxAge: d.maxAge,
                  gender: d.gender,
                  imageUrl: d.imageUrl,
                  spots: d.spots,
                  rsvp: d.rsvp,
                  recurring: d.recurring,
                  roles: d.roles,
                  published: d.published,
                  seatsTaken: d.seatsTaken,
                  attendeeKeys: d.attendeeKeys,
                  attendees: d.attendees,
                );

                await navigator.push(
                  MaterialPageRoute(
                    builder: (context) => EventShowcase(event: evt),
                  ),
                );
                if (mounted) _loadEvents();
              },
              onCancel: () => _cancelRsvp(eventRef),
            ),

            Positioned(
              bottom: 12,
              right: 12,
              child: IconButton(
                tooltip: 'Add to Calendar',
                icon: const Icon(Icons.calendar_month_outlined),
                onPressed: () async {
                  final d = eventRef.event;
                  if (d == null) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Event details could not be loaded. Please try again later.',
                        ),
                      ),
                    );
                    return;
                  }

                  final evt = event_model.Event(
                    id: d.id.isNotEmpty ? d.id : eventRef.eventId,
                    name: d.name,
                    ruName: d.ruName,
                    description: d.description,
                    ruDescription: d.ruDescription,
                    date: d.date,
                    location: d.location,
                    price: d.price,
                    ministry: d.ministry,
                    minAge: d.minAge,
                    maxAge: d.maxAge,
                    gender: d.gender,
                    imageUrl: d.imageUrl,
                    spots: d.spots,
                    rsvp: d.rsvp,
                    recurring: d.recurring,
                    roles: d.roles,
                    published: d.published,
                    seatsTaken: d.seatsTaken,
                    attendeeKeys: d.attendeeKeys,
                    attendees: d.attendees,
                  );

                  _onAddToCalendar(evt);
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEmptyState() {
    String message;
    String subMessage;

    if (_allEvents.isEmpty) {
      message = "You haven't registered for any events yet";
      subMessage = "When you RSVP to events, they'll appear here";
    } else {
      message = "No events match your filters";
      subMessage = "Try adjusting your search or filter settings";
    }

    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.event_busy,
            size: 64,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subMessage,
            style: TextStyle(
              fontSize: 14,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // Generate + open/share an .ics file (iOS + Android fallback)
  Future<void> _shareIcsForEvent(event_model.Event event) async {
    final DateTime startUtc = event.date.toUtc();
    final DateTime endUtc = startUtc.add(const Duration(hours: 1));

    String two(int n) => n.toString().padLeft(2, '0');
    String fmt(DateTime dt) =>
        '${dt.year}${two(dt.month)}${two(dt.day)}T${two(dt.hour)}${two(dt.minute)}${two(dt.second)}Z';
    String esc(String s) => s
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;');

    final ics = '''
  BEGIN:VCALENDAR
  VERSION:2.0
  PRODID:-//ChurchLink//Events//EN
  BEGIN:VEVENT
  UID:${event.id}@churchlink
  DTSTAMP:${fmt(DateTime.now().toUtc())}
  DTSTART:${fmt(startUtc)}
  DTEND:${fmt(endUtc)}
  SUMMARY:${esc(event.name)}
  DESCRIPTION:${esc(event.description)}
  LOCATION:${esc(event.location)}
  BEGIN:VALARM
  TRIGGER:-PT60M
  ACTION:DISPLAY
  DESCRIPTION:Reminder
  END:VALARM
  END:VEVENT
  END:VCALENDAR
  ''';

    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/event_${event.id}.ics';
    final file = File(path);
    await file.writeAsString(ics);

    final result = await OpenFilex.open(path);
    if (result.type != ResultType.done) {
      await Share.shareXFiles(
        [XFile(path, mimeType: 'text/calendar', name: 'event_${event.id}.ics')],
        subject: 'Add to Calendar',
        text: 'Open this to add the event to your calendar.',
      );
    }
  }

  // ANDROID-ONLY: open the Calendar “insert event” screen
  Future<bool> _openAndroidCalendarInsert(
    event_model.Event e, {
    String? packageName,
  }) async {
    try {
      final start = e.date.toLocal();
      final end = start.add(const Duration(hours: 1));
      final intent = AndroidIntent(
        action: 'android.intent.action.INSERT',
        data: 'content://com.android.calendar/events',
        package: packageName, // null => let Android pick
        arguments: <String, dynamic>{
          'title': e.name,
          'description': e.description,
          'eventLocation': e.location,
          'beginTime': start.millisecondsSinceEpoch,
          'endTime': end.millisecondsSinceEpoch,
        },
      );
      await intent.launch();
      return true;
    } catch (_) {
      return false;
    }
  }

  void _onAddToCalendar(event_model.Event event) async {
    if (Platform.isAndroid) {
      if (await _openAndroidCalendarInsert(
        event,
        packageName: 'com.google.android.calendar',
      ))
        return;
      if (await _openAndroidCalendarInsert(event)) return;
      await _shareIcsForEvent(event);
      return;
    }
    // iOS: share .ics
    await _shareIcsForEvent(event);
  }
}

