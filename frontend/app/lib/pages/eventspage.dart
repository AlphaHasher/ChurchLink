import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';

import 'package:android_intent_plus/android_intent.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/helpers/event_user_helper.dart';
import 'package:app/helpers/ministries_helper.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/models/ministry.dart';
import 'package:app/pages/event_showcase.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/widgets/event_card.dart';

class EventsPage extends StatefulWidget {
  const EventsPage({super.key});

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends State<EventsPage> {
  // Data & pagination
  final List<UserFacingEvent> _events = <UserFacingEvent>[];
  EventsCursor? _nextCursor;
  bool _isInitialLoading = true;
  bool _isRefreshing = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;

  // Ministries
  List<Ministry> _ministries = <Ministry>[];
  Map<String, Ministry> _ministriesById = <String, Ministry>{};

  // Filters (aligned with UserEventSearchParams)
  int? _minAge;
  int? _maxAge;
  String? _gender; // "all" | "male" | "female" | "male_only" | "female_only"
  final Set<String> _selectedMinistryIds = <String>{};
  bool _uniqueOnly = false;
  bool _favoritesOnly = false;
  bool _membersOnlyOnly = false;
  double? _maxPrice;

  // Debounce for numeric filters (age / price)
  Timer? _debounce;

  // Form controllers
  late final TextEditingController _minAgeController;
  late final TextEditingController _maxAgeController;
  late final TextEditingController _maxPriceController;

  @override
  void initState() {
    super.initState();
    _minAgeController = TextEditingController();
    _maxAgeController = TextEditingController();
    _maxPriceController = TextEditingController();

    _loadInitial();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _minAgeController.dispose();
    _maxAgeController.dispose();
    _maxPriceController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  Future<void> _loadInitial() async {
    setState(() {
      _isInitialLoading = true;
      _hasMore = true;
      _events.clear();
      _nextCursor = null;
    });

    await _loadMinistries();
    await _fetchPage(reset: true);

    if (mounted) {
      setState(() {
        _isInitialLoading = false;
      });
    }
  }

  Future<void> _loadMinistries() async {
    try {
      final list = await MinistriesHelper.fetchMinistries();
      if (!mounted) return;

      setState(() {
        _ministries = list;
        _ministriesById = {for (final m in list) m.id: m};
      });
    } catch (e, st) {
      // Hard fail on ministries is not worth it, just log and move on
      debugPrint('Failed to load ministries: $e\n$st');
    }
  }

  UserEventSearchParams _buildSearchParams({bool forNextPage = false}) {
    return UserEventSearchParams(
      limit: 12,
      minAge: _minAge,
      maxAge: _maxAge,
      gender: _gender,
      ministries:
          _selectedMinistryIds.isEmpty ? null : _selectedMinistryIds.toList(),
      uniqueOnly: _uniqueOnly ? true : null,
      preferredLang: LocalizationHelper.currentLocale,
      cursorScheduledDate: forNextPage ? _nextCursor?.scheduledDate : null,
      cursorId: forNextPage ? _nextCursor?.id : null,
      favoritesOnly: _favoritesOnly ? true : null,
      membersOnlyOnly: _membersOnlyOnly ? true : null,
      maxPrice: _maxPrice,
    );
  }

  Future<void> _fetchPage({bool reset = false}) async {
    if (!mounted) return;
    if (!reset && (!_hasMore || _isLoadingMore)) return;

    if (reset) {
      _nextCursor = null;
      _hasMore = true;
    }

    setState(() {
      if (reset) {
        _isInitialLoading = true;
      } else {
        _isLoadingMore = true;
      }
    });

    try {
      final params = _buildSearchParams(forNextPage: !reset);
      final results = await EventUserHelper.fetchUserEvents(params);
      if (!mounted || results == null) return;

      final converted = convertUserFacingEventsToUserTime(
        results.items.toList(),
      );

      setState(() {
        if (reset) {
          _events
            ..clear()
            ..addAll(converted);
        } else {
          _events.addAll(converted);
        }
        _nextCursor = results.nextCursor;
        _hasMore = _nextCursor != null;
      });
    } catch (e, st) {
      debugPrint('fetchUserEvents failed: $e\n$st');
    } finally {
      if (!mounted) return;
      setState(() {
        _isInitialLoading = false;
        _isRefreshing = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _onRefresh() async {
    if (!mounted) return;
    setState(() {
      _isRefreshing = true;
    });
    await _fetchPage(reset: true);
  }

  void _onLoadMore() {
    _fetchPage(reset: false);
  }

  // ---------------------------------------------------------------------------
  // FILTER SHEET
  // ---------------------------------------------------------------------------

  void _showFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        String? tempGender = _gender;
        bool tempUniqueOnly = _uniqueOnly;
        bool tempFavoritesOnly = _favoritesOnly;
        bool tempMembersOnlyOnly = _membersOnlyOnly;
        final tempMinistryIds = Set<String>.from(_selectedMinistryIds);
        double? tempMaxPrice = _maxPrice;
        int? tempMinAge = _minAge;
        int? tempMaxAge = _maxAge;

        final minAgeController = TextEditingController(
          text: tempMinAge?.toString() ?? '',
        );
        final maxAgeController = TextEditingController(
          text: tempMaxAge?.toString() ?? '',
        );
        final maxPriceController = TextEditingController(
          text: tempMaxPrice?.toString() ?? '',
        );

        return StatefulBuilder(
          builder: (context, setModalState) {
            void updateDebounced(void Function() updater) {
              updater();
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 400), () {});
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      LocalizationHelper.localize('Filter Events'),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Gender
                    DropdownButtonFormField<String>(
                      decoration: InputDecoration(
                        labelText: LocalizationHelper.localize('Gender'),
                      ),
                      value: tempGender,
                      items:
                          <String?>[
                            null,
                            'all',
                            'male',
                            'female',
                            'male_only',
                            'female_only',
                          ].map((g) {
                            String label;
                            switch (g) {
                              case null:
                                label = LocalizationHelper.localize(
                                  'Show All Events',
                                );
                                break;
                              case 'all':
                                label = LocalizationHelper.localize(
                                  'All Genders Allowed',
                                );
                                break;
                              case 'male':
                                label = LocalizationHelper.localize(
                                  'Male Only (any)',
                                );
                                break;
                              case 'female':
                                label = LocalizationHelper.localize(
                                  'Female Only (any)',
                                );
                                break;
                              case 'male_only':
                                label = LocalizationHelper.localize(
                                  'Male Only Events (targeted)',
                                );
                                break;
                              case 'female_only':
                                label = LocalizationHelper.localize(
                                  'Female Only Events (targeted)',
                                );
                                break;
                              default:
                                label = g;
                            }
                            return DropdownMenuItem<String>(
                              value: g,
                              child: Text(label),
                            );
                          }).toList(),
                      onChanged:
                          (value) => setModalState(() => tempGender = value),
                    ),
                    const SizedBox(height: 12),
                    // Min / Max Age
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: minAgeController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: LocalizationHelper.localize('Min Age'),
                            ),
                            onChanged:
                                (v) => updateDebounced(() {
                                  tempMinAge = int.tryParse(v);
                                }),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: maxAgeController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: LocalizationHelper.localize('Max Age'),
                            ),
                            onChanged:
                                (v) => updateDebounced(() {
                                  tempMaxAge = int.tryParse(v);
                                }),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Max price
                    TextField(
                      controller: maxPriceController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: LocalizationHelper.localize(
                          'Max Price (USD)',
                        ),
                      ),
                      onChanged:
                          (v) => updateDebounced(() {
                            tempMaxPrice = double.tryParse(v);
                          }),
                    ),
                    const SizedBox(height: 12),
                    // Ministry multi-select
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        LocalizationHelper.localize('Ministries'),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (_ministries.isEmpty)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          LocalizationHelper.localize('No ministries found.'),
                        ),
                      )
                    else
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children:
                            _ministries.map((m) {
                              final selected = tempMinistryIds.contains(m.id);
                              return FilterChip(
                                label: Text(m.name),
                                selected: selected,
                                onSelected: (value) {
                                  setModalState(() {
                                    if (value) {
                                      tempMinistryIds.add(m.id);
                                    } else {
                                      tempMinistryIds.remove(m.id);
                                    }
                                  });
                                },
                              );
                            }).toList(),
                      ),
                    const SizedBox(height: 12),
                    // Boolean toggles
                    SwitchListTile(
                      value: tempUniqueOnly,
                      title: Text(
                        LocalizationHelper.localize(
                          'Show only one per event series',
                        ),
                      ),
                      onChanged:
                          (value) =>
                              setModalState(() => tempUniqueOnly = value),
                    ),
                    SwitchListTile(
                      value: tempMembersOnlyOnly,
                      title: Text(
                        LocalizationHelper.localize(
                          'Show only members-only events',
                        ),
                      ),
                      onChanged:
                          (value) =>
                              setModalState(() => tempMembersOnlyOnly = value),
                    ),
                    FutureBuilder<bool>(
                      future: FirebaseAuthService.instance.isSignedIn(),
                      builder: (context, snapshot) {
                        final isSignedIn = snapshot.data ?? false;
                        if (!isSignedIn) return const SizedBox.shrink();
                        return SwitchListTile(
                          value: tempFavoritesOnly,
                          title: Text(
                            LocalizationHelper.localize(
                              'Show only favorite events',
                            ),
                          ),
                          onChanged:
                              (value) => setModalState(
                                () => tempFavoritesOnly = value,
                              ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    // Buttons
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () {
                            setModalState(() {
                              tempGender = null;
                              tempMinAge = null;
                              tempMaxAge = null;
                              tempMaxPrice = null;
                              tempMinistryIds.clear();
                              tempUniqueOnly = false;
                              tempFavoritesOnly = false;
                              tempMembersOnlyOnly = false;

                              minAgeController.clear();
                              maxAgeController.clear();
                              maxPriceController.clear();
                            });
                          },
                          child: Text(
                            LocalizationHelper.localize('Reset'),
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _gender = tempGender;
                              _minAge = tempMinAge;
                              _maxAge = tempMaxAge;
                              _maxPrice = tempMaxPrice;
                              _selectedMinistryIds
                                ..clear()
                                ..addAll(tempMinistryIds);
                              _uniqueOnly = tempUniqueOnly;
                              _favoritesOnly = tempFavoritesOnly;
                              _membersOnlyOnly = tempMembersOnlyOnly;

                              _minAgeController.text =
                                  _minAge?.toString() ?? '';
                              _maxAgeController.text =
                                  _maxAge?.toString() ?? '';
                              _maxPriceController.text =
                                  _maxPrice?.toString() ?? '';
                            });
                            Navigator.of(context).pop();
                            _fetchPage(reset: true);
                          },
                          child: Text(
                            LocalizationHelper.localize('Apply Filters'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------------------------

  Future<void> _navigateToShowcase(UserFacingEvent event) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => EventShowcase(event: event)),
    );

    if (mounted) {
      // Refresh events after returning (to update favorites, registrations etc.)
      _fetchPage(reset: true);
    }
  }

  // ---------------------------------------------------------------------------
  // CALENDAR / ICS
  // ---------------------------------------------------------------------------

  EventLocalization _locForEvent(UserFacingEvent e) {
    final locale = LocalizationHelper.currentLocale;
    final langOnly = locale.split('_').first.split('-').first;

    if (e.localizations.containsKey(locale)) {
      return e.localizations[locale]!;
    }
    if (e.localizations.containsKey(langOnly)) {
      return e.localizations[langOnly]!;
    }
    if (e.localizations.isNotEmpty) return e.localizations.values.first;

    return EventLocalization(
      title: e.defaultTitle,
      description: e.defaultDescription,
      locationInfo: e.defaultLocationInfo,
    );
  }

  Future<void> _shareIcsForEvent(UserFacingEvent event) async {
    final loc = _locForEvent(event);

    final DateTime startUtc =
        safeParseIsoLocal(event.date)?.toUtc() ?? DateTime.now().toUtc();
    final DateTime endUtc =
        event.endDate != null
            ? (safeParseIsoLocal(event.endDate!)?.toUtc() ??
                startUtc.add(const Duration(hours: 1)))
            : startUtc.add(const Duration(hours: 1));

    String two(int n) => n.toString().padLeft(2, '0');
    String fmt(DateTime dt) =>
        '${dt.year}${two(dt.month)}${two(dt.day)}T${two(dt.hour)}${two(dt.minute)}${two(dt.second)}Z';

    String esc(String s) => s
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;');

    final location =
        event.locationAddress?.isNotEmpty == true
            ? event.locationAddress!
            : loc.locationInfo;

    final ics = '''
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ChurchLink//Events//EN
BEGIN:VEVENT
UID:${event.id}@churchlink
DTSTAMP:${fmt(DateTime.now().toUtc())}
DTSTART:${fmt(startUtc)}
DTEND:${fmt(endUtc)}
SUMMARY:${esc(loc.title)}
DESCRIPTION:${esc(loc.description)}
LOCATION:${esc(location)}
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
      final xfile = XFile(
        path,
        mimeType: 'text/calendar',
        name: 'event_${event.id}.ics',
      );
      await Share.shareXFiles(
        [xfile],
        subject: LocalizationHelper.localize('Add to Calendar'),
        text: LocalizationHelper.localize(
          'Open this to add the event to your calendar.',
        ),
      );
    }
  }

  Future<bool> _openAndroidCalendarInsert(
    UserFacingEvent e, {
    String? packageName,
  }) async {
    try {
      final start = safeParseIsoLocal(e.date)?.toLocal() ?? DateTime.now();
      final end =
          e.endDate != null
              ? (safeParseIsoLocal(e.endDate!)?.toLocal() ??
                  start.add(const Duration(hours: 1)))
              : start.add(const Duration(hours: 1));

      final loc = _locForEvent(e);
      final location =
          e.locationAddress?.isNotEmpty == true
              ? e.locationAddress!
              : loc.locationInfo;

      final intent = AndroidIntent(
        action: 'android.intent.action.INSERT',
        data: 'content://com.android.calendar/events',
        package: packageName,
        arguments: <String, dynamic>{
          'title': loc.title,
          'description': loc.description,
          'eventLocation': location,
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

  void _onAddToCalendar(UserFacingEvent event) async {
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

    await _shareIcsForEvent(event);
  }

  // ---------------------------------------------------------------------------
  // FAVORITES
  // ---------------------------------------------------------------------------

  Future<void> _toggleFavorite(UserFacingEvent event, bool newValue) async {
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx == -1) return;

    setState(() {
      _events[idx] = UserFacingEvent(
        id: event.id,
        eventId: event.eventId,
        seriesIndex: event.seriesIndex,
        date: event.date,
        endDate: event.endDate,
        seatsFilled: event.seatsFilled,
        localizations: event.localizations,
        recurring: event.recurring,
        registrationAllowed: event.registrationAllowed,
        hidden: event.hidden,
        registrationOpens: event.registrationOpens,
        registrationDeadline: event.registrationDeadline,
        automaticRefundDeadline: event.automaticRefundDeadline,
        ministries: event.ministries,
        membersOnly: event.membersOnly,
        rsvpRequired: event.rsvpRequired,
        maxSpots: event.maxSpots,
        price: event.price,
        memberPrice: event.memberPrice,
        minAge: event.minAge,
        maxAge: event.maxAge,
        gender: event.gender,
        locationAddress: event.locationAddress,
        imageId: event.imageId,
        paymentOptions: event.paymentOptions,
        updatedOn: event.updatedOn,
        overridesDateUpdatedOn: event.overridesDateUpdatedOn,
        defaultTitle: event.defaultTitle,
        defaultDescription: event.defaultDescription,
        defaultLocationInfo: event.defaultLocationInfo,
        defaultLocalization: event.defaultLocalization,
        eventDate: event.eventDate,
        hasRegistrations: event.hasRegistrations,
        eventRegistrations: event.eventRegistrations,
        isFavorited: newValue,
      );
    });

    try {
      await EventUserHelper.setFavorite(event.eventId, newValue);
    } catch (e, st) {
      debugPrint('Failed to update favorite: $e\n$st');
    }
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
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
                  onPressed: () => Navigator.pop(context),
                )
                : null,
        automaticallyImplyLeading: showBackButton,
      ),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: RefreshIndicator(
          onRefresh: _onRefresh,
          child:
              _isInitialLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _events.isEmpty
                  ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 60),
                      Center(
                        child: Text(
                          LocalizationHelper.localize('No events found.'),
                        ),
                      ),
                    ],
                  )
                  : SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        ListView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          shrinkWrap: true,
                          itemCount: _events.length,
                          itemBuilder: (context, index) {
                            final event = _events[index];
                            return EventCard(
                              event: event,
                              ministriesById: _ministriesById,
                              onTap: () => _navigateToShowcase(event),
                              onAddToCalendar: () => _onAddToCalendar(event),
                              onFavoriteChanged:
                                  (value) => _toggleFavorite(event, value),
                            );
                          },
                        ),
                        if (_hasMore)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child:
                                _isLoadingMore
                                    ? const CircularProgressIndicator()
                                    : OutlinedButton(
                                      onPressed: _onLoadMore,
                                      child: Text(
                                        LocalizationHelper.localize(
                                          'Load More',
                                        ),
                                      ),
                                    ),
                          ),
                        if (_isRefreshing)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                  ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showFilterSheet,
        child: const Icon(Icons.filter_list),
      ),
    );
  }
}
