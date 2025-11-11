import 'package:flutter/material.dart';
import 'dart:async';

import 'package:app/helpers/api_client.dart';
import 'package:app/models/event.dart';
import 'package:app/models/event_registration_summary.dart';
import 'package:app/services/event_registration_service.dart';
import 'package:app/pages/event_showcase.dart';
import 'package:app/widgets/event_card.dart';
import 'package:app/helpers/localization_helper.dart';

// ICS sharing + open
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:open_filex/open_filex.dart';

import 'package:android_intent_plus/android_intent.dart';

class EventsPage extends StatefulWidget {
  const EventsPage({super.key});

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends State<EventsPage> {
  List<Event> _events = [];
  bool _isLoading = true;
  final Map<String, EventRegistrationSummary> _registrationSummaries = {};
  Timer? _refreshTimer;

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
    _maxPriceController = TextEditingController(
      text: _maxPrice?.toString() ?? '',
    );
    _ageController = TextEditingController(text: _age?.toString() ?? '');

    // Adjust the date slider so that it only shows one year in advance from the current date
    _minDate = DateTime.now();
    _maxDate = DateTime.now().add(const Duration(days: 365));
    final totalDays = _maxDate.difference(_minDate).inDays.toDouble();
    _dateRange = RangeValues(0, totalDays);

    _loadEvents();

    // Auto-refresh every 60 seconds when page is visible
    _refreshTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) _loadEvents();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
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
    queryParams['date_after'] =
        _minDate
            .add(Duration(days: _dateRange.start.round()))
            .toIso8601String()
            .split('T')
            .first;

    if (_dateRange.end < totalDays) {
      queryParams['date_before'] =
          _minDate
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
        final allEvents = jsonData.map((json) => Event.fromJson(json)).toList();

        // Filter to only show upcoming events
        final upcomingEvents = Event.upcomingEvents(allEvents);

        setState(() {
          _events = upcomingEvents;
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
        debugPrint(
          'Failed to load registration summary for event ${event.id}: $e',
        );
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
                    onChanged:
                        (value) => setModalState(
                          () => tempMaxPrice = double.tryParse(value),
                        ),
                  ),
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Gender"),
                    initialValue: tempGender,
                    items:
                        [
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
                            label =
                                '${g[0].toUpperCase()}${g.substring(1)} Only';
                          }
                          return DropdownMenuItem<String>(
                            value: g,
                            child: Text(label),
                          );
                        }).toList(),
                    onChanged:
                        (value) => setModalState(() => tempGender = value),
                  ),
                  TextField(
                    controller: _ageController,
                    decoration: const InputDecoration(labelText: "Age"),
                    keyboardType: TextInputType.number,
                    onChanged:
                        (value) =>
                            setModalState(() => tempAge = int.tryParse(value)),
                  ),
                  DropdownButtonFormField<String>(
                    decoration: const InputDecoration(labelText: "Ministry"),
                    initialValue: tempMinistry,
                    items:
                        [
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
                    onChanged:
                        (value) => setModalState(() => tempMinistry = value),
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
                          _minDate
                              .add(Duration(days: _dateRange.start.round()))
                              .toString()
                              .split(' ')[0],
                          _minDate
                              .add(Duration(days: _dateRange.end.round()))
                              .toString()
                              .split(' ')[0],
                        ),
                        onChanged:
                            (values) =>
                                setModalState(() => tempDateRange = values),
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
                            _maxPriceController.text =
                                _maxPrice?.toString() ?? '';
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

  // Generate + open/share an .ics file for the event (iOS + Android fallback)
  Future<void> _shareIcsForEvent(Event event) async {
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

    // Try opening directly (ACTION_VIEW). If no app can handle it, show share sheet.
    final result = await OpenFilex.open(path);
    if (result.type != ResultType.done) {
      final xfile = XFile(path, mimeType: 'text/calendar', name: 'event_${event.id}.ics');
      await Share.shareXFiles(
        [xfile],
        subject: 'Add to Calendar',
        text: 'Open this to add the event to your calendar.',
      );
    }
  }

  // ANDROID-ONLY: launch the Calendar "insert event" screen directly.
  Future<bool> _openAndroidCalendarInsert(
    Event e, {
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
          // 'allDay': false,
        },
      );

      await intent.launch();
      return true;
    } catch (_) {
      return false;
    }
  }

  void _onAddToCalendar(Event event) async {
    // For Android, attempt to open it in Google Calendar directly
    // If it fails, use the same protocol but allow users to pick a calendar
    // If it fails that, use generic file sharing
    if (Platform.isAndroid) {
      if (await _openAndroidCalendarInsert(
        event,
        packageName: 'com.google.android.calendar',
      )) {
        return;
      }
      if (await _openAndroidCalendarInsert(event)) {
        return;
      }
      await _shareIcsForEvent(event);
      return;
    }

    // On iOS, share as an .ics file
    // NOTE: I'm unsure about how the OS handles this and can't test this
    await _shareIcsForEvent(event);
  }

  @override
  Widget build(BuildContext context) {
    // Determine if we should show the back button:
    // - If Navigator.canPop() is true, we were pushed from another screen (e.g., home page)
    // - If Navigator.canPop() is false, we are the root of the events tab (accessed via navbar)
    final bool showBackButton = Navigator.canPop(context);

    return Scaffold(
      key: const ValueKey('screen-events'),
      appBar: AppBar(
        centerTitle: true,
        title: Text(LocalizationHelper.localize('Events')),
        leading:
            showBackButton
                ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () {
                    Navigator.pop(context);
                  },
                )
                : null,
        automaticallyImplyLeading: showBackButton,
      ),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: RefreshIndicator(
          onRefresh: _loadEvents,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              children: [
                _isLoading
                    ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 50),
                      child: Center(child: CircularProgressIndicator()),
                    )
                    : _events.isEmpty
                    ? Padding(
                       padding: EdgeInsets.symmetric(vertical: 50),
                       child: Text(LocalizationHelper.localize("No events found.")),
                     )
                    : ListView.builder(
                      physics: const NeverScrollableScrollPhysics(),
                      shrinkWrap: true,
                      itemCount: _events.length,
                      itemBuilder: (context, index) {
                        final event = _events[index];
                        return Stack(
                          children: [
                            EventCard(
                              event: event,
                              onViewPressed: () => _navigateToShowcase(event),
                              registrationSummary:
                                  _registrationSummaries[event.id],
                            ),
                            Positioned(
                              bottom: 12,
                              right: 12,
                              child: IconButton(
                                tooltip: 'Add to Calendar',
                                icon: const Icon(Icons.calendar_month_outlined),
                                onPressed: () => _onAddToCalendar(event),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.filter_list),
        onPressed: () => _showFilterSheet(context),
      ),
    );
  }
}
