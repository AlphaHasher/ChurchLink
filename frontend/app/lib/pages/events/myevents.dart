import 'dart:io';

import 'package:flutter/material.dart';

import 'package:android_intent_plus/android_intent.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:app/pages/events/event_showcase_v2.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/helpers/event_user_helper.dart';
import 'package:app/helpers/ministries_helper.dart';

import 'package:app/models/event_v2.dart';
import 'package:app/models/ministry.dart';

import 'package:app/widgets/events/event_card.dart';

/// "My Events" page: mirrors EventsPage, but backed by /v1/events/search-my-events
/// and uses the MyEvents filters (type/date) like MyEventsPageV2.tsx.
class MyEventsPage extends StatefulWidget {
  const MyEventsPage({super.key});

  @override
  State<MyEventsPage> createState() => _MyEventsPageState();
}

class _MyEventsPageState extends State<MyEventsPage> {
  // Data & pagination
  final List<UserFacingEvent> _events = <UserFacingEvent>[];
  EventsCursor? _nextCursor;
  bool _isInitialLoading = true;
  bool _isRefreshing = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;

  // Ministries
  Map<String, Ministry> _ministriesById = <String, Ministry>{};

  // MyEvents filters (mirror MyEventsPageV2.tsx)
  MyEventsTypeFilter _typeFilter = MyEventsTypeFilter.favoritesAndRegistered;
  MyEventsDateFilter _dateFilter = MyEventsDateFilter.upcoming;

  static const int _baseLimit = 12;

  @override
  void initState() {
    super.initState();
    _loadMinistries();
    _loadInitial();
  }

  // ---------------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------------

  Future<void> _loadMinistries() async {
    try {
      final list = await MinistriesHelper.fetchMinistries();
      if (!mounted) return;

      setState(() {
        _ministriesById = {for (final m in list) m.id: m};
      });
    } catch (e, st) {
      debugPrint('Failed to load ministries: $e\n$st');
    }
  }

  MyEventsSearchParams _buildSearchParams({
    required bool forNextPage,
    int? overrideLimit,
  }) {
    final int limit = overrideLimit ?? _baseLimit;

    final String? cursorScheduledDate =
        forNextPage && _nextCursor != null ? _nextCursor!.scheduledDate : null;
    final String? cursorId =
        forNextPage && _nextCursor != null ? _nextCursor!.id : null;

    return MyEventsSearchParams(
      type: _typeFilter,
      date: _dateFilter,
      limit: limit,
      preferredLang: null, // will be filled in by EventUserHelper
      cursorScheduledDate: cursorScheduledDate,
      cursorId: cursorId,
    );
  }

  Future<void> _loadInitial() async {
    if (!mounted) return;
    setState(() {
      _isInitialLoading = true;
      _hasMore = true;
      _events.clear();
      _nextCursor = null;
    });

    await _fetchPage(reset: true);
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
      final MyEventsResults res = await EventUserHelper.fetchMyEvents(params);

      if (!mounted) return;

      setState(() {
        if (reset) {
          _events
            ..clear()
            ..addAll(res.items);
        } else {
          _events.addAll(res.items);
        }
        _nextCursor = res.nextCursor;
        _hasMore = res.nextCursor != null;
      });
    } catch (e, st) {
      debugPrint('fetchMyEvents failed: $e\n$st');
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
  // CALENDAR + ICS SHARING (copied from EventsPage)
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
  // NAVIGATION
  // ---------------------------------------------------------------------------

  void _navigateToShowcase(UserFacingEvent event) {
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (_) => EventShowcaseV2(initialEvent: event),
          ),
        )
        .then((_) {
          if (!mounted) return;
          // Always reload events when returning from the showcase
          _onRefresh();
        });
  }

  // ---------------------------------------------------------------------------
  // FILTERS UI (MyEvents type/date) – inline bar
  // ---------------------------------------------------------------------------

  Widget _buildFiltersBar() {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          children: [
            Row(
              children: [
                // Type filter
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        localize('Which Type of Events to Show'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.textTheme.bodySmall?.color?.withOpacity(
                            0.8,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      DropdownButtonFormField<MyEventsTypeFilter>(
                        value: _typeFilter,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 8,
                          ),
                        ),
                        items:
                            MyEventsTypeFilter.values.map((t) {
                              late String label;
                              switch (t) {
                                case MyEventsTypeFilter.favoritesAndRegistered:
                                  label = localize('Registered or Favorited');
                                  break;
                                case MyEventsTypeFilter.registered:
                                  label = localize('All Registered');
                                  break;
                                case MyEventsTypeFilter.registeredNotFavorited:
                                  label = localize('Registered Only');
                                  break;
                                case MyEventsTypeFilter.favorites:
                                  label = localize('All Favorited');
                                  break;
                                case MyEventsTypeFilter.favoritesNotRegistered:
                                  label = localize('Favorited Only');
                                  break;
                              }
                              return DropdownMenuItem<MyEventsTypeFilter>(
                                value: t,
                                child: Text(
                                  label,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                        onChanged: (val) {
                          if (val == null) return;
                          setState(() {
                            _typeFilter = val;
                          });
                          _loadInitial();
                        },
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 12),

                // Date filter
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        localize('When the Events take Place'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.textTheme.bodySmall?.color?.withOpacity(
                            0.8,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      DropdownButtonFormField<MyEventsDateFilter>(
                        value: _dateFilter,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 8,
                          ),
                        ),
                        items:
                            MyEventsDateFilter.values.map((d) {
                              late String label;
                              switch (d) {
                                case MyEventsDateFilter.upcoming:
                                  label = localize('Upcoming');
                                  break;
                                case MyEventsDateFilter.history:
                                  label = localize('History');
                                  break;
                                case MyEventsDateFilter.all:
                                  label = localize('All');
                                  break;
                              }
                              return DropdownMenuItem<MyEventsDateFilter>(
                                value: d,
                                child: Text(
                                  label,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                        onChanged: (val) {
                          if (val == null) return;
                          setState(() {
                            _dateFilter = val;
                          });
                          _loadInitial();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Scaffold(
      key: const ValueKey('screen-my-events'),
      appBar: AppBar(
        centerTitle: true,
        title: Text(localize('My Events'), overflow: TextOverflow.ellipsis),
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
                          localize('No events matched your filters.'),
                          style: theme.textTheme.bodyMedium,
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  )
                  : SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        const SizedBox(height: 8),
                        _buildFiltersBar(),
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
    );
  }
}
