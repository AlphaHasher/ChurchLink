import 'package:flutter/material.dart';
import '../models/my_events.dart';
import '../services/my_events_service.dart';
import '../widgets/my_event_card.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'event_showcase.dart';
import '../models/event.dart' as event_model;

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
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                eventRef.isFamilyMember
                    ? 'RSVP cancelled for ${eventRef.effectiveDisplayName}'
                    : 'Your RSVP has been cancelled',
              ),
              backgroundColor: Colors.green,
            ),
          );
        }

        // Refresh the events list
        if (mounted) {
          _loadEvents();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to cancel RSVP'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      // Close loading indicator if still showing
      if (mounted) Navigator.of(context).pop();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text('My Events', style: TextStyle(color: Colors.white)),
        centerTitle: true,
      ),
      backgroundColor: const Color.fromARGB(255, 245, 245, 245),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withAlpha((0.1 * 255).round()),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Search Field
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              hintText: 'Search events...',
              prefixIcon: Icon(Icons.search, color: Colors.grey),
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
              const SizedBox(width: 8),
              Expanded(
                child: _buildFilterChip(
                  label: 'Toggle Family',
                  isSelected: _filters.showFamily,
                  onTap:
                      () => setState(() {
                        _filters = _filters.copyWith(
                          showFamily: !_filters.showFamily,
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
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected ? ssbcGray : Colors.grey[350],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? ssbcGray.withOpacity(0.9) : Colors.grey[300]!,
            width: isSelected ? 1.25 : 1.0,
          ),
          boxShadow:
              isSelected
                  ? [
                    // very subtle elevation when active
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 6,
                      offset: const Offset(0, 3),
                    ),
                  ]
                  : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color:
                isSelected
                    ? Colors.white
                    : const Color.fromARGB(221, 78, 78, 78),
            fontSize: 12,
            fontWeight: FontWeight.w500,
            decoration:
                isSelected ? TextDecoration.underline : TextDecoration.none,
            decorationColor: isSelected ? Colors.white.withOpacity(0.95) : null,
            decorationThickness: isSelected ? 1.5 : null,
            decorationStyle: TextDecorationStyle.solid,
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
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: const TextStyle(fontSize: 16, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadEvents,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                foregroundColor: Colors.white,
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
        return MyEventCard(
          eventRef: eventRef,
          onTap: () async {
            // Capture navigator before any async gaps so we don't use BuildContext after awaits
            final navigator = Navigator.of(context);

            // Try to refresh auth token so the ApiClient interceptor has a valid token
            try {
              final user = FirebaseAuth.instance.currentUser;
              if (user != null) {
                await user.getIdToken();
              }
            } catch (_) {
              // Ignore token refresh errors; EventShowcase will handle unauthenticated state
            }

            if (!mounted) return;

            // Convert MyEventDetails -> Event model expected by EventShowcase
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

            // Push the EventShowcase page. EventShowcase will manage auth-sensitive content.
            await navigator.push(
              MaterialPageRoute(
                builder: (context) => EventShowcase(event: evt),
              ),
            );

            // Refresh after returning (if still mounted)
            if (mounted) _loadEvents();
          },
          onCancel: () => _cancelRsvp(eventRef),
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

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.event_busy, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: Colors.grey,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subMessage,
            style: const TextStyle(fontSize: 14, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
