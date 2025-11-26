import 'dart:io';

import 'package:app/pages/events/event_showcase_v2.dart';
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
import 'package:app/widgets/events/event_card.dart';

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

  // Filters (mirror EventSection.tsx)
  String _gender =
      'all'; // "all" | "male" | "female" | "male_only" | "female_only"
  String _minAgeStr = '';
  String _maxAgeStr = '';
  String _maxPriceStr = '';
  final Set<String> _selectedMinistryIds = <String>{};
  bool _uniqueOnly = false;
  bool _favoritesOnly = false;
  bool _membersOnlyOnly = false;

  static const int _baseLimit = 12;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  // ---------------------------------------------------------------------------
  // LOADING & PARAM BUILDING
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

    if (!mounted) return;
    setState(() {
      _isInitialLoading = false;
    });
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
      debugPrint('Failed to load ministries: $e\n$st');
    }
  }

  UserEventSearchParams _buildSearchParams({
    required bool forNextPage,
    int? overrideLimit,
  }) {
    final int limit = overrideLimit ?? _baseLimit;

    final int? minAge =
        _minAgeStr.trim().isNotEmpty ? int.tryParse(_minAgeStr) : null;
    final int? maxAge =
        _maxAgeStr.trim().isNotEmpty ? int.tryParse(_maxAgeStr) : null;
    final double? maxPrice =
        _maxPriceStr.trim().isNotEmpty ? double.tryParse(_maxPriceStr) : null;

    // Gender: "all" -> null, others as-is
    final String? genderParam = _gender == 'all' ? null : _gender;

    return UserEventSearchParams(
      limit: limit,
      minAge: minAge,
      maxAge: maxAge,
      gender: genderParam,
      ministries:
          _selectedMinistryIds.isEmpty ? null : _selectedMinistryIds.toList(),
      uniqueOnly: _uniqueOnly,
      favoritesOnly: EventUserHelper.isSignedIn ? _favoritesOnly : null,
      membersOnlyOnly: _membersOnlyOnly,
      maxPrice: maxPrice,
      preferredLang: LocalizationHelper.currentLocale,
      cursorScheduledDate: forNextPage ? _nextCursor?.scheduledDate : null,
      cursorId: forNextPage ? _nextCursor?.id : null,
    );
  }

  Future<void> _fetchPage({required bool reset, int? overrideLimit}) async {
    if (!mounted) return;
    if (!reset && (!_hasMore || _isLoadingMore)) return;

    if (reset) {
      _nextCursor = null;
      _hasMore = true;
    }

    setState(() {
      if (reset && !_isRefreshing) {
        _isInitialLoading = true;
      } else if (!reset) {
        _isLoadingMore = true;
      }
    });

    try {
      final params = _buildSearchParams(
        forNextPage: !reset,
        overrideLimit: overrideLimit,
      );
      final results = await EventUserHelper.fetchUserEvents(params);

      if (!mounted) return;

      setState(() {
        if (reset) {
          _events
            ..clear()
            ..addAll(results.items);
        } else {
          _events.addAll(results.items);
        }
        _nextCursor = results.nextCursor;
        _hasMore = _nextCursor != null;
      });
    } catch (e, st) {
      debugPrint('fetchUserEvents failed: $e\n$st');
    } finally {
      if (mounted) {
        setState(() {
          _isInitialLoading = false;
          _isRefreshing = false;
          _isLoadingMore = false;
        });
      }
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
  // FILTER SHEET (UI → filter state)
  // ---------------------------------------------------------------------------

  String _summarizeTempMinistries(List<Ministry> all, Set<String> selected) {
    if (all.isEmpty) {
      return LocalizationHelper.localize('No ministries available');
    }
    if (selected.isEmpty) {
      return LocalizationHelper.localize('All ministries');
    }
    if (selected.length == 1) {
      return LocalizationHelper.localize('1 selected');
    }
    return LocalizationHelper.localize('${selected.length} selected');
  }

  void _showFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final theme = Theme.of(ctx);
        final textTheme = theme.textTheme;
        final colorScheme = theme.colorScheme;
        final localize = LocalizationHelper.localize;

        String tempGender = _gender;
        bool tempUniqueOnly = _uniqueOnly;
        bool tempFavoritesOnly = _favoritesOnly;
        bool tempMembersOnlyOnly = _membersOnlyOnly;
        final tempMinistryIds = Set<String>.from(_selectedMinistryIds);
        String tempMinAge = _minAgeStr;
        String tempMaxAge = _maxAgeStr;
        String tempMaxPrice = _maxPriceStr;
        bool ministriesExpanded = false;

        final minAgeController = TextEditingController(text: tempMinAge);
        final maxAgeController = TextEditingController(text: tempMaxAge);
        final maxPriceController = TextEditingController(text: tempMaxPrice);

        final isSignedIn = EventUserHelper.isSignedIn;

        return StatefulBuilder(
          builder: (context, setModalState) {
            final infoStyle = textTheme.bodySmall?.copyWith(
              color: textTheme.bodySmall?.color?.withValues(alpha: 0.7),
            );

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
                      localize('Filter Events'),
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Gender
                    DropdownButtonFormField<String>(
                      decoration: InputDecoration(
                        labelText: localize('Gender admission'),
                      ),
                      initialValue: tempGender,
                      items:
                          const <String>[
                            'all',
                            'male',
                            'female',
                            'male_only',
                            'female_only',
                          ].map((g) {
                            String label;
                            switch (g) {
                              case 'all':
                                label = localize('All Allowed');
                                break;
                              case 'male':
                                label = localize('Men Allowed');
                                break;
                              case 'female':
                                label = localize('Women Allowed');
                                break;
                              case 'male_only':
                                label = localize('Men Only');
                                break;
                              case 'female_only':
                                label = localize('Women Only');
                                break;
                              default:
                                label = g;
                            }
                            return DropdownMenuItem<String>(
                              value: g,
                              child: Text(label),
                            );
                          }).toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        setModalState(() => tempGender = value);
                      },
                    ),
                    const SizedBox(height: 12),

                    // Unique-only
                    SwitchListTile(
                      value: tempUniqueOnly,
                      title: Text(localize('Show only one per series')),
                      subtitle: Text(
                        localize('Unique only (earliest upcoming per event)'),
                        style: infoStyle,
                      ),
                      onChanged:
                          (value) =>
                              setModalState(() => tempUniqueOnly = value),
                    ),
                    const SizedBox(height: 4),

                    // Min / Max Age
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: minAgeController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: localize('Minimum Age'),
                            ),
                            onChanged:
                                (v) => setModalState(() {
                                  tempMinAge = v.replaceAll(
                                    RegExp(r'[^\d]'),
                                    '',
                                  );
                                }),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: maxAgeController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: localize('Maximum Age'),
                            ),
                            onChanged:
                                (v) => setModalState(() {
                                  tempMaxAge = v.replaceAll(
                                    RegExp(r'[^\d]'),
                                    '',
                                  );
                                }),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        localize(
                          'We’ll show events where everyone between your minimum and maximum ages would be allowed to attend.',
                        ),
                        style: infoStyle,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Ministries "dropdown-style" multi-select
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: theme.dividerColor.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Theme(
                        // Remove default ExpansionTile splash color overrides
                        data: theme.copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          childrenPadding: const EdgeInsets.only(
                            left: 12,
                            right: 12,
                            bottom: 8,
                          ),
                          initiallyExpanded: ministriesExpanded,
                          onExpansionChanged: (expanded) {
                            setModalState(() {
                              ministriesExpanded = expanded;
                            });
                          },
                          title: Text(
                            localize('Ministries'),
                            style: textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            _summarizeTempMinistries(
                              _ministries,
                              tempMinistryIds,
                            ),
                            style: infoStyle,
                          ),
                          children: [
                            if (_ministries.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 4,
                                ),
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    localize('No ministries found.'),
                                    style: infoStyle,
                                  ),
                                ),
                              )
                            else
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxHeight: 260,
                                ),
                                child: Scrollbar(
                                  child: ListView.builder(
                                    shrinkWrap: true,
                                    itemCount: _ministries.length,
                                    itemBuilder: (context, index) {
                                      final m = _ministries[index];
                                      final selected = tempMinistryIds.contains(
                                        m.id,
                                      );
                                      return CheckboxListTile(
                                        dense: true,
                                        controlAffinity:
                                            ListTileControlAffinity.leading,
                                        value: selected,
                                        title: Text(
                                          LocalizationHelper.localize(m.name),
                                        ),
                                        onChanged: (value) {
                                          setModalState(() {
                                            if (value == true) {
                                              tempMinistryIds.add(m.id);
                                            } else {
                                              tempMinistryIds.remove(m.id);
                                            }
                                          });
                                        },
                                      );
                                    },
                                  ),
                                ),
                              ),
                            if (tempMinistryIds.isNotEmpty)
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed:
                                      () => setModalState(
                                        () => tempMinistryIds.clear(),
                                      ),
                                  child: Text(
                                    localize('Clear'),
                                    style: TextStyle(color: colorScheme.error),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Members-only
                    SwitchListTile(
                      value: tempMembersOnlyOnly,
                      title: Text(localize('Members-only events only')),
                      onChanged:
                          (value) =>
                              setModalState(() => tempMembersOnlyOnly = value),
                    ),

                    // Favorites-only (auth only)
                    if (isSignedIn)
                      SwitchListTile(
                        value: tempFavoritesOnly,
                        title: Text(localize('Favorites only')),
                        onChanged:
                            (value) =>
                                setModalState(() => tempFavoritesOnly = value),
                      ),

                    const SizedBox(height: 4),

                    // Max price
                    TextField(
                      controller: maxPriceController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: localize('Maximum Price (USD)'),
                      ),
                      onChanged:
                          (v) => setModalState(() {
                            tempMaxPrice = v.replaceAll(RegExp(r'[^\d.]'), '');
                          }),
                    ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        localize(
                          'We’ll show events that are either free or priced at or below this amount in \$USD.',
                        ),
                        style: infoStyle,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Buttons
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () {
                            setModalState(() {
                              tempGender = 'all';
                              tempMinAge = '';
                              tempMaxAge = '';
                              tempMaxPrice = '';
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
                            localize('Reset'),
                            style: TextStyle(color: colorScheme.error),
                          ),
                        ),
                        ElevatedButton(
                          style: ButtonStyle(
                            backgroundColor: WidgetStatePropertyAll(
                              theme.primaryColor,
                            ),
                            foregroundColor: WidgetStatePropertyAll(
                              Colors.white,
                            ),
                          ),
                          onPressed: () {
                            setState(() {
                              _gender = tempGender;
                              _minAgeStr = tempMinAge;
                              _maxAgeStr = tempMaxAge;
                              _maxPriceStr = tempMaxPrice;
                              _selectedMinistryIds
                                ..clear()
                                ..addAll(tempMinistryIds);
                              _uniqueOnly = tempUniqueOnly;
                              _favoritesOnly = tempFavoritesOnly;
                              _membersOnlyOnly = tempMembersOnlyOnly;
                            });
                            Navigator.of(context).pop();
                            _fetchPage(reset: true);
                          },
                          child: Text(localize('Apply Filters')),
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
      MaterialPageRoute(
        builder: (context) => EventShowcaseV2(initialEvent: event),
      ),
    ).then((_) {
      if (!mounted) return;
      _onRefresh();
    });
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
    if (e.localizations.isNotEmpty) {
      return e.localizations.values.first;
    }

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
      await SharePlus.instance.share(
        ShareParams(
          files: [xfile],
          subject: LocalizationHelper.localize('Add to Calendar'),
          text: LocalizationHelper.localize(
            'Open this to add the event to your calendar.',
          ),
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
  // FAVORITES: REFRESH LIKE WEB
  // ---------------------------------------------------------------------------

  Future<void> _toggleFavorite(UserFacingEvent event, bool newValue) async {
    setState(() {
      _isRefreshing = true;
    });

    try {
      await EventUserHelper.setFavorite(event.eventId, newValue);

      final int overrideLimit =
          _events.length > _baseLimit ? _events.length : _baseLimit;
      await _fetchPage(reset: true, overrideLimit: overrideLimit);
    } catch (e, st) {
      debugPrint('Failed to update favorite: $e\n$st');
      await _fetchPage(reset: true);
    }
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Scaffold(
      key: const ValueKey('screen-events'),
      appBar: AppBar(
        centerTitle: true,
        title: Text(
          localize('Upcoming Events'),
          overflow: TextOverflow.ellipsis,
        ),
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
                          localize('There are no upcoming events.'),
                          style: theme.textTheme.bodyMedium,
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
                                      child: Text(localize('Load more')),
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
