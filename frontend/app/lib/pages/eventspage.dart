import 'package:flutter/material.dart';

import '../helpers/api_client.dart';
import '../models/event.dart';
import '../models/event_registration_summary.dart';
import '../services/event_registration_service.dart';
import '../widgets/enhanced_event_card.dart';
import 'event_showcase.dart';
import 'package:app/services/notification_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class EventsPage extends StatefulWidget {
  const EventsPage({super.key});

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends State<EventsPage> {
  List<Event> _events = [];
  bool _isLoading = true;
  Map<String, EventRegistrationSummary> _registrationSummaries = {};

  // Declare variables for dynamic filter values
  int? _minAge;
  int? _maxAge;
  String? _ministry;
  String? _nameQuery;
  double? _maxPrice;
  String? _gender;
  int? _age;
  late DateTime _minDate;
  late DateTime _maxDate;
  late RangeValues _dateRange;
  late TextEditingController _nameController;
  late TextEditingController _maxPriceController;
  late TextEditingController _ageController;

  @override
  void initState() {
    super.initState();

    // Utilized for entering text into filters
    _nameController = TextEditingController(text: _nameQuery ?? '');
    _maxPriceController = TextEditingController(text: _maxPrice?.toString() ?? '');
    _ageController = TextEditingController(text: _age?.toString() ?? '');

    // Adjust the date slider so that it only shows one year in advance from the current date
    _minDate = DateTime.now();
    _maxDate = DateTime.now().add(const Duration(days: 365));
    final totalDays = _maxDate.difference(_minDate).inDays.toDouble();
    _dateRange = RangeValues(0, totalDays);

    _loadEvents();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _maxPriceController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  Future<void> _loadEvents() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
    });

    final totalDays = _maxDate.difference(_minDate).inDays.toDouble();

    final queryParams = <String, String>{
      if (_minAge != null) 'min_age': _minAge.toString(),
      if (_maxAge != null) 'max_age': _maxAge.toString(),
      if (_ministry != null) 'ministry': _ministry!,
      if (_nameQuery != null && _nameQuery!.isNotEmpty) 'name': _nameQuery!,
      if (_maxPrice != null) 'max_price': _maxPrice.toString(),
      if (_age != null) 'age': _age.toString(),
      if (_gender != null) 'gender': _gender!,
    };

    // Always include upcoming-only events
    queryParams['date_after'] = _minDate
        .add(Duration(days: _dateRange.start.round()))
        .toIso8601String()
        .split('T')
        .first;

    if (_dateRange.end < totalDays) {
      queryParams['date_before'] = _minDate
          .add(Duration(days: _dateRange.end.round()))
          .toIso8601String()
          .split('T')
          .first;
    }

    // Free events shortcut (max_price == 0)
    if (_maxPrice == 0) {
      queryParams['is_free'] = 'true';
    }

    try {
      final response = await api.get(
        '/v1/events/',
        queryParameters: queryParams,
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        final List<dynamic> jsonData = response.data;
        setState(() {
          _events = jsonData.map((json) => Event.fromJson(json)).toList();
          _isLoading = false;
        });
        // Load registration details for all events
        _loadRegistrationDetails();
      } else {
        debugPrint("Failed to load events: ${response.statusCode}");
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    } catch (e) {
      debugPrint("Error loading events: $e");
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadRegistrationDetails() async {
    for (final event in _events) {
      if (!mounted) return; // Exit early if widget is disposed

      try {
        final summary =
            await EventRegistrationService.getEventRegistrationSummary(
              event.id,
            );

        if (!mounted) return; // Check again after async operation

        setState(() {
          _registrationSummaries[event.id] = summary;
        });
      } catch (e) {
        debugPrint('Failed to load registration summary for event ${event.id}: $e');
      }
    }
  }

  void _showFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        String? tempGender = _gender;
        String? tempMinistry = _ministry;
        String? tempName = _nameQuery;
        double? tempMaxPrice = _maxPrice;
        int? tempAge = _age;
        RangeValues tempDateRange = _dateRange;

        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                runSpacing: 12,
                children: [
                  const Text(
                    "Filter Events",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),

                  TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: "Search by Name",
                    ),
                    onChanged: (value) => setModalState(() => tempName = value),
                  ),

                  TextField(
                    controller: _maxPriceController,
                    decoration: const InputDecoration(labelText: "Max Price"),
                    keyboardType: TextInputType.number,
                    onChanged: (value) => setModalState(() => tempMaxPrice = double.tryParse(value)),
                  ),

                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Gender"),
                    value: tempGender,
                    items: [
                      null, // Show all: no filtering
                      'all', // Only "All Genders" events
                      'male',
                      'female',
                    ].map((g) {
                      String label;
                      if (g == null) {
                        label = 'Show All';
                      } else if (g == 'all') {
                        label = 'All Genders Allowed';
                      } else {
                        label = '${g[0].toUpperCase()}${g.substring(1)} Only';
                      }
                      return DropdownMenuItem<String>(
                        value: g,
                        child: Text(label),
                      );
                    }).toList(),
                    onChanged: (value) => setModalState(() => tempGender = value),
                  ),

                  TextField(
                    controller: _ageController,
                    decoration: const InputDecoration(labelText: "Age"),
                    keyboardType: TextInputType.number,
                    onChanged: (value) => setModalState(() => tempAge = int.tryParse(value)),
                  ),

                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Ministry"),
                    value: tempMinistry,
                    items: [
                      null,
                      'Children',
                      'Education',
                      'Family',
                      'Music',
                      'Quo Vadis Theater',
                      'Skala Teens',
                      'VBS',
                      'United Service',
                      'Women\'s Ministries',
                      'Youth',
                    ].map((m) {
                      return DropdownMenuItem<String>(
                        value: m,
                        child: Text(m ?? 'All Ministries'),
                      );
                    }).toList(),
                    onChanged: (value) => setModalState(() => tempMinistry = value),
                  ),

                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Date Range",
                        style: TextStyle(fontWeight: FontWeight.w500),
                      ),
                      RangeSlider(
                        values: tempDateRange,
                        min: 0,
                        max: _maxDate.difference(_minDate).inDays.toDouble(),
                        divisions: 20,
                        labels: RangeLabels(
                          _minDate.add(Duration(days: _dateRange.start.round())).toString().split(' ')[0],
                          _minDate.add(Duration(days: _dateRange.end.round())).toString().split(' ')[0],
                        ),
                        onChanged: (values) => setModalState(() => tempDateRange = values),
                      ),
                    ],
                  ),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: () {
                          setModalState(() {
                            tempGender = null;
                            tempMinistry = null;
                            tempName = null;
                            tempMaxPrice = null;
                            tempAge = null;
                            tempDateRange = RangeValues(
                              0,
                              _maxDate.difference(_minDate).inDays.toDouble(),
                            );

                            _nameController.clear();
                            _maxPriceController.clear();
                            _ageController.clear();
                          });
                        },
                        child: const Text(
                          "Reset Filters",
                          style: TextStyle(color: Colors.red),
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _gender = tempGender;
                            _ministry = tempMinistry;
                            _nameQuery = tempName;
                            _maxPrice = tempMaxPrice;
                            _age = tempAge;
                            _dateRange = tempDateRange;

                            _nameController.text = _nameQuery ?? '';
                            _maxPriceController.text = _maxPrice?.toString() ?? '';
                            _ageController.text = _age?.toString() ?? '';
                          });
                          Navigator.pop(context);
                          _loadEvents();
                        },
                        child: const Text("Apply Filters"),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _navigateToShowcase(Event event) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => EventShowcase(event: event)),
    );

    // Refresh the events data when returning from the showcase
    if (mounted) {
      _loadEvents();
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Padding(
          padding: EdgeInsets.only(left: 100),
          child: Text("Events", style: TextStyle(color: Colors.white)),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      backgroundColor: const Color.fromARGB(255, 240, 240, 240),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 50),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : _events.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 50),
                          child: Text("No events found."),
                        )
                      : ListView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          shrinkWrap: true,
                          itemCount: _events.length,
                          itemBuilder: (context, index) {
                            final event = _events[index];
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                EnhancedEventCard(
                                  event: event,
                                  onViewPressed: () => _navigateToShowcase(event),
                                  registrationSummary: _registrationSummaries[event.id],
                                ),

                                // Action row: "Remind me" popup (right aligned)
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: PopupMenuButton<String>(
                                    icon: const Icon(Icons.alarm_add),
                                    onSelected: (v) async {
                                      final DateTime start = event.date; // assumed DateTime

                                      if (v == '1m') {
                                        // Debug: fires ~1 minute from now
                                        final t = DateTime.now().add(const Duration(minutes: 1));
                                        await NotificationService.instance.scheduleEventReminder(
                                          eventId: event.id,
                                          title: 'Test: ${event.name}',
                                          body: 'Should fire in ~1 minute.',
                                          eventStartLocal: t,
                                          offset: Duration.zero,
                                        );
                                      } else if (v == '1h') {
                                        await NotificationService.instance.scheduleEventReminder(
                                          eventId: event.id,
                                          title: event.name,
                                          body: 'Starts in 1 hour${event.location != null ? " at ${event.location}" : ""}',
                                          eventStartLocal: start,
                                          offset: const Duration(hours: 1),
                                        );
                                      } else if (v == '1d') {
                                        await NotificationService.instance.scheduleEventReminder(
                                          eventId: event.id,
                                          title: 'Tomorrow: ${event.name}',
                                          body:
                                              'Starts at ${start.hour.toString().padLeft(2, "0")}:${start.minute.toString().padLeft(2, "0")}',
                                          eventStartLocal: start,
                                          offset: const Duration(days: 1),
                                        );
                                      } else if (v == 'off') {
                                        await NotificationService.instance.cancelEventReminder(event.id);
                                      }

                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Reminder updated')),
                                        );
                                      }
                                    },
                                    itemBuilder: (_) => const [
                                      PopupMenuItem(value: '1m', child: Text('Remind in 1 minute (debug)')),
                                      PopupMenuItem(value: '1h', child: Text('Remind 1 hour before')),
                                      PopupMenuItem(value: '1d', child: Text('Remind 1 day before')),
                                      PopupMenuItem(value: 'off', child: Text('Remove reminder')),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 8),
                              ],
                            );
                          },
                        ),
            ],
          ),
        ),
      ),

      // Diagnostics footer (temporary; remove after testing)
      persistentFooterButtons: [
        TextButton(
          onPressed: () async {
            final pending = await FlutterLocalNotificationsPlugin().pendingNotificationRequests();
            debugPrint('PENDING=${pending.length}');
            for (final p in pending) {
              debugPrint('id=${p.id} title=${p.title}');
            }
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Pending: ${pending.length}')),
              );
            }
          },
          child: const Text('List pending'),
        ),
        TextButton(
          onPressed: () async {
            await FlutterLocalNotificationsPlugin().cancelAll();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('All reminders canceled')),
              );
            }
          },
          child: const Text('Cancel all'),
        ),
      ],

      // Two FABs: Show now + Test 1m + Filter
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Show now (immediate)
          FloatingActionButton.extended(
            heroTag: 'fab-show-now',
            backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            icon: const Icon(Icons.notifications_active),
            label: const Text('Show now'),
            onPressed: () async {
              await FlutterLocalNotificationsPlugin().show(
                99001,
                'Immediate test',
                'If you see this, notifications work.',
                const NotificationDetails(
                  android: AndroidNotificationDetails(
                    'events',
                    'Event Reminders',
                    importance: Importance.max,
                    priority: Priority.high,
                  ),
                  iOS: DarwinNotificationDetails(),
                ),
                payload: 'immediate',
              );
            },
          ),
          const SizedBox(height: 12),

          // Test 1-minute FAB
          FloatingActionButton.extended(
            heroTag: 'fab-test-1m',
            backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            icon: const Icon(Icons.alarm),
            label: const Text('Test 1m'),
            onPressed: () async {
              final t = DateTime.now().add(const Duration(minutes: 1));
              await NotificationService.instance.scheduleEventReminder(
                eventId: 'debug-1m',
                title: 'Test reminder',
                body: 'Should fire in ~1 minute.',
                eventStartLocal: t,
                offset: Duration.zero,
              );
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Reminder scheduled for ~1 minute')),
                );
              }
            },
          ),
          const SizedBox(height: 12),

          // Existing Filter FAB
          FloatingActionButton(
            heroTag: 'fab-filter',
            backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            child: const Icon(Icons.filter_list),
            onPressed: () => _showFilterSheet(context),
          ),
        ],
      ),
    );
  }
}
