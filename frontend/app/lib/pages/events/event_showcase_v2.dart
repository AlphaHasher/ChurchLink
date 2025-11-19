import 'dart:async';
import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/helpers/event_user_helper.dart';
import 'package:app/helpers/asset_helper.dart';
import 'package:app/helpers/backend_helper.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/models/ministry.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:app/widgets/events/event_ticket_card.dart';
import 'package:app/widgets/events/event_map_card.dart';
import 'package:app/pages/events/registration_payment_page.dart';
import 'package:app/pages/user/family_members_page.dart';

class EventShowcaseV2 extends StatefulWidget {
  final UserFacingEvent initialEvent;

  const EventShowcaseV2({super.key, required this.initialEvent});

  @override
  State<EventShowcaseV2> createState() => _EventShowcaseV2State();
}

enum RegPhase { closed, notOpenYet, deadlinePassed, open }

class _EventShowcaseV2State extends State<EventShowcaseV2> {
  UserFacingEvent? _event;
  List<SisterInstanceIdentifier> _sisters = <SisterInstanceIdentifier>[];
  List<Ministry> _ministries = <Ministry>[];
  bool _isLoading = true;
  String? _errorMessage;

  bool _isFav = false;
  bool _busyFav = false;
  String? _shareMsg;
  bool _openSisters = false;

  @override
  void initState() {
    super.initState();
    _event = widget.initialEvent;
    _isFav = widget.initialEvent.isFavorited;
    _loadDetails(widget.initialEvent.id);
  }

  EventLocalization _locForEvent(UserFacingEvent e) {
    final locale = LocalizationHelper.currentLocale;

    if (e.defaultLocalization == locale) {
      return e.localizations[locale]!;
    }

    return EventLocalization(
      title: LocalizationHelper.localize(e.defaultTitle),
      description: LocalizationHelper.localize(e.defaultDescription),
      locationInfo: LocalizationHelper.localize(e.defaultLocationInfo),
    );
  }

  String _formatSingleDate(DateTime dt) {
    String weekday(int w) =>
        const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w % 7];

    String month(int m) =>
        const [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ][m - 1];

    String two(int n) => n.toString().padLeft(2, '0');
    var hour = dt.hour;
    final minute = dt.minute;
    final isPm = hour >= 12;
    var h12 = hour % 12;
    if (h12 == 0) h12 = 12;
    final suffix = isPm ? 'PM' : 'AM';

    return '${weekday(dt.weekday % 7)}, ${month(dt.month)} ${dt.day}, ${dt.year} · $h12:${two(minute)} $suffix';
  }

  Future<void> _loadDetails(String instanceId) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await EventUserHelper.fetchEventInstanceDetails(instanceId);
      if (!mounted) return;

      if (res.success && res.eventDetails != null) {
        setState(() {
          _event = res.eventDetails;
          _sisters = res.sisterDetails;
          _ministries = res.ministries;
          _isFav = res.eventDetails!.isFavorited;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = res.msg.isNotEmpty ? res.msg : 'Failed to load event';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // FAVORITE + SHARE
  // ---------------------------------------------------------------------------

  Future<void> _toggleFavorite() async {
    final event = _event;
    if (event == null || _busyFav) return;

    setState(() {
      _busyFav = true;
    });

    try {
      final next = !_isFav;
      final ok = await EventUserHelper.setFavorite(event.eventId, next);
      if (!mounted) return;

      if (ok) {
        setState(() {
          _isFav = next;
        });
      }
    } catch (e) {
      // ignore, UI stays as-is
    } finally {
      if (mounted) {
        setState(() {
          _busyFav = false;
        });
      }
    }
  }

  Future<void> _shareEvent() async {
    final event = _event;
    if (event == null) return;

    try {
      final baseUrl = BackendHelper.webBase;
      final sharableUrl = '$baseUrl/sharable_events/${event.id}';

      await SharePlus.instance.share(
        ShareParams(
          text: sharableUrl,
          subject: LocalizationHelper.localize('Check out this event'),
        ),
      );

      if (!mounted) return;
      setState(() {
        _shareMsg = LocalizationHelper.localize(
          'Share sheet opened. Choose an app to share this event.',
        );
      });
      // Clear the message after a short delay
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (!mounted) return;
        setState(() => _shareMsg = null);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _shareMsg = LocalizationHelper.localize('Unable to share right now.');
      });
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (!mounted) return;
        setState(() => _shareMsg = null);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CALENDAR / ICS (same semantics as EventsPage / EventCard)
  // ---------------------------------------------------------------------------

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

  void _onAddToCalendar() async {
    final event = _event;
    if (event == null) return;

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
  // BUILD HELPERS
  // ---------------------------------------------------------------------------

  String? _formatMinistryNames(
    List<String> ministryIds,
    List<Ministry> ministries,
  ) {
    if (ministryIds.isEmpty || ministries.isEmpty) return null;
    final map = {
      for (final m in ministries)
        if (m.id.isNotEmpty) m.id: m.name,
    };
    final names =
        ministryIds
            .map((id) {
              final name = map[id];
              if (name == null || name.trim().isEmpty) return null;
              return LocalizationHelper.localize(name);
            })
            .whereType<String>()
            .toList();
    if (names.isEmpty) return null;
    return names.join(' • ');
  }

  Widget _buildScheduleCard(UserFacingEvent e) {
    final loc = LocalizationHelper.localize;

    final start = safeParseIsoLocal(e.date);
    final end = e.endDate != null ? safeParseIsoLocal(e.endDate!) : null;

    final startStr = start != null ? _formatSingleDate(start) : '—';
    final endStr = end != null ? _formatSingleDate(end) : null;

    final isRecurring = e.recurring != EventRecurrence.never;

    final currentId = e.id;
    final otherSisters = _sisters.where((s) => s.id != currentId).toList();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header + Add to Calendar
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 18),
                const SizedBox(width: 8),
                Text(
                  loc('Schedule'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _onAddToCalendar,
                  icon: const Icon(Icons.calendar_month_outlined, size: 18),
                  label: Text(
                    loc('Add to My Calendar'),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (endStr != null) ...[
              Text(
                loc('Start Time'),
                style: const TextStyle(
                  fontSize: 11,
                  color: Colors.grey,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                startStr,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                loc('End Time'),
                style: const TextStyle(
                  fontSize: 11,
                  color: Colors.grey,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                endStr,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ] else ...[
              Text(
                startStr,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (isRecurring)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF), // indigo-50
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.repeat,
                          size: 14,
                          color: Color(0xFF4F46E5),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          loc('Repeats ${e.recurring.name}'),
                          style: const TextStyle(
                            color: Color(0xFF3730A3),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      loc('One-time'),
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF374151),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),
            if (otherSisters.isNotEmpty) ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: () {
                  setState(() {
                    _openSisters = !_openSisters;
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 6,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${loc('Other upcoming events in the series')} (${otherSisters.length})',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      AnimatedRotation(
                        turns: _openSisters ? 0.5 : 0.0,
                        duration: const Duration(milliseconds: 180),
                        child: const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_openSisters)
                Column(
                  children:
                      otherSisters.map((s) {
                        final sisterDate = safeParseIsoLocal(s.date);
                        final sisterLabel =
                            sisterDate != null
                                ? _formatSingleDate(sisterDate)
                                : loc('Unknown date');

                        return Container(
                          margin: const EdgeInsets.only(top: 6),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  sisterLabel,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                              TextButton(
                                onPressed: () {
                                  if (s.id == e.id) return;
                                  _openSisters = false;
                                  _loadDetails(s.id);
                                },
                                child: Text(
                                  loc('View'),
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAllowedAttendanceCard(UserFacingEvent e) {
    final loc = LocalizationHelper.localize;

    String membershipLabel;
    Color membershipBg;
    Color membershipFg;
    IconData membershipIcon;

    if (e.membersOnly) {
      membershipLabel = loc('Members Only');
      membershipBg = const Color(0xFFF5F3FF); // purple-50
      membershipFg = const Color(0xFF6D28D9); // purple-700
      membershipIcon = Icons.badge_outlined;
    } else {
      membershipLabel = loc('Members & Non-Members Allowed');
      membershipBg = const Color(0xFFECFDF5); // emerald-50
      membershipFg = const Color(0xFF047857); // emerald-700
      membershipIcon = Icons.people_outline;
    }

    String genderLabel;
    IconData genderIcon;
    Color genderBg;
    Color genderFg;

    switch (e.gender) {
      case EventGenderOption.male:
        genderLabel = loc('Men Only');
        genderIcon = Icons.male;
        genderBg = const Color(0xFFE0F2FE); // blue-50
        genderFg = const Color(0xFF1D4ED8); // blue-700
        break;
      case EventGenderOption.female:
        genderLabel = loc('Women Only');
        genderIcon = Icons.female;
        genderBg = const Color(0xFFFDF2F8); // pink-50
        genderFg = const Color(0xFFBE185D); // pink-700
        break;
      case EventGenderOption.all:
        genderLabel = loc('Both Genders Allowed');
        genderIcon = Icons.people_alt_outlined;
        genderBg = const Color(0xFFECFDF5); // emerald-50
        genderFg = const Color(0xFF047857); // emerald-700
        break;
    }

    String ageLabel;
    if (e.minAge == null && e.maxAge == null) {
      ageLabel = loc('All Ages');
    } else if (e.minAge != null && e.maxAge != null) {
      ageLabel = '${e.minAge}-${e.maxAge} ${loc('Years Old')}';
    } else if (e.minAge != null) {
      ageLabel = '${e.minAge} ${loc('Years Old and Over')}';
    } else {
      ageLabel = '${e.maxAge} ${loc('Years Old and Under')}';
    }

    Widget badge({
      required String label,
      required Color bg,
      required Color fg,
      IconData? icon,
    }) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: bg.withValues(alpha: 0.6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.badge_outlined, size: 18),
                const SizedBox(width: 8),
                Text(
                  loc('Allowed Attendance'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  loc('Membership:'),
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 4),
                badge(
                  label: membershipLabel,
                  bg: membershipBg,
                  fg: membershipFg,
                  icon: membershipIcon,
                ),
                const SizedBox(height: 10),
                Text(
                  loc('Gender:'),
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 4),
                badge(
                  label: genderLabel,
                  bg: genderBg,
                  fg: genderFg,
                  icon: genderIcon,
                ),
                const SizedBox(height: 10),
                Text(
                  loc('Age Range:'),
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 4),
                badge(
                  label: ageLabel,
                  bg: const Color(0xFFF8FAFC),
                  fg: const Color(0xFF334155),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPricingCard(UserFacingEvent e) {
    final loc = LocalizationHelper.localize;

    final price = e.price;
    final member = e.memberPrice;

    final memberIsNumber = member is num;

    final stdIsZero = price == 0;
    final memberIsZero = memberIsNumber && member == 0;

    String fmtMoney(num? n) {
      if (n == null) return '';
      return '\$${n.toStringAsFixed(2)}';
    }

    String free;
    final lang = LocalizationHelper.currentLocale;
    if (lang == 'en') {
      free = 'FREE';
    } else {
      free = loc('NO COST');
    }

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.attach_money, size: 18),
                const SizedBox(width: 8),
                Text(
                  loc('Pricing'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (stdIsZero)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Text(
                  loc(free),
                  style: const TextStyle(
                    color: Color(0xFF047857),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (price > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '${loc('Standard Price:')} ${fmtMoney(price)}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  if (memberIsNumber)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${loc('Member Price:')} ',
                          style: const TextStyle(fontSize: 13),
                        ),
                        if (memberIsZero)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: const Color(0xFFA7F3D0),
                              ),
                            ),
                            child: Text(
                              loc(free),
                              style: const TextStyle(
                                color: Color(0xFF047857),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          )
                        else
                          Text(
                            fmtMoney(member),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCapacityCard(UserFacingEvent e) {
    if (!e.rsvpRequired) {
      return const SizedBox.shrink();
    }

    final loc = LocalizationHelper.localize;
    final maxSpots = e.maxSpots ?? 0;
    final seats = e.seatsFilled;
    final remaining = maxSpots > 0 ? (maxSpots - seats).clamp(0, maxSpots) : 0;
    final isFull = maxSpots > 0 && seats >= maxSpots;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.people_outline, size: 18),
                const SizedBox(width: 8),
                Text(
                  loc('Event Capacity'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color:
                        e.rsvpRequired
                            ? const Color(0xFFE0F2FE)
                            : const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color:
                          e.rsvpRequired
                              ? const Color(0xFFBFDBFE)
                              : const Color(0xFFA7F3D0),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        e.rsvpRequired ? Icons.info_outline : Icons.check,
                        size: 16,
                        color:
                            e.rsvpRequired
                                ? const Color(0xFF1D4ED8)
                                : const Color(0xFF047857),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        e.rsvpRequired
                            ? loc('Registration Required')
                            : loc('No Registration Required'),
                        style: TextStyle(
                          color:
                              e.rsvpRequired
                                  ? const Color(0xFF1D4ED8)
                                  : const Color(0xFF047857),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (!e.rsvpRequired || maxSpots == 0)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.check_circle,
                      size: 16,
                      color: Color(0xFF047857),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      loc('Unlimited Event Capacity'),
                      style: const TextStyle(
                        color: Color(0xFF047857),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.people,
                          size: 16,
                          color: Color(0xFF334155),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${loc('Event Reg:')} $seats / $maxSpots',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF334155),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isFull)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F2),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            size: 16,
                            color: Color(0xFFB91C1C),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            loc('EVENT FULL'),
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFFB91C1C),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.check_circle,
                            size: 16,
                            color: Color(0xFF047857),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$remaining ${loc('Spots Left')}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF047857),
                              fontWeight: FontWeight.w600,
                            ),
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

  Widget _buildRegistrationCard(UserFacingEvent e) {
    if (!e.rsvpRequired) {
      return const SizedBox.shrink();
    }

    final loc = LocalizationHelper.localize;

    final now = DateTime.now();
    final opens =
        e.registrationOpens != null
            ? safeParseIsoLocal(e.registrationOpens!)?.toLocal()
            : null;
    final deadline =
        e.registrationDeadline != null
            ? safeParseIsoLocal(e.registrationDeadline!)?.toLocal()
            : null;

    String fmt(DateTime? dt) {
      if (dt == null) return '—';
      return _formatSingleDate(dt);
    }

    RegPhase regPhase;
    if (!e.registrationAllowed) {
      regPhase = RegPhase.closed;
    } else if (opens != null && now.isBefore(opens)) {
      regPhase = RegPhase.notOpenYet;
    } else if (deadline != null && now.isAfter(deadline)) {
      regPhase = RegPhase.deadlinePassed;
    } else {
      regPhase = RegPhase.open;
    }

    Widget buildStatusChip() {
      switch (regPhase) {
        case RegPhase.closed:
          return _statusChip(
            label: loc('Registration Closed'),
            bg: const Color(0xFFFFF1F2),
            fg: const Color(0xFFB91C1C),
            icon: Icons.shield_outlined,
            border: const Color(0xFFFECACA),
          );
        case RegPhase.notOpenYet:
          return _statusChip(
            label: loc('Registration Not Open'),
            bg: const Color(0xFFFFFBEB),
            fg: const Color(0xFF92400E),
            icon: Icons.access_time,
            border: const Color(0xFFFDE68A),
          );
        case RegPhase.deadlinePassed:
          return _statusChip(
            label: loc('Registration Deadline Passed'),
            bg: const Color(0xFFFFF1F2),
            fg: const Color(0xFFB91C1C),
            icon: Icons.warning_amber_rounded,
            border: const Color(0xFFFECACA),
          );
        case RegPhase.open:
          return _statusChip(
            label: loc('Registration Open'),
            bg: const Color(0xFFECFDF5),
            fg: const Color(0xFF047857),
            icon: Icons.check_circle,
            border: const Color(0xFFA7F3D0),
          );
      }
    }

    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.info_outline, size: 18),
                const SizedBox(width: 8),
                Text(
                  loc('Registration'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Ownership badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color:
                    e.hasRegistrations
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color:
                      e.hasRegistrations
                          ? const Color(0xFFA7F3D0)
                          : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    e.hasRegistrations
                        ? Icons.check_circle
                        : Icons.info_outline,
                    size: 18,
                    color:
                        e.hasRegistrations
                            ? const Color(0xFF047857)
                            : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      e.hasRegistrations
                          ? loc('You have registrations for this event')
                          : loc('You do not have registrations for this event'),
                      style: TextStyle(
                        fontSize: 12,
                        color:
                            e.hasRegistrations
                                ? const Color(0xFF047857)
                                : const Color(0xFF64748B),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            // Status / opens / deadline
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${loc('Status')}: ',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    buildStatusChip(),
                  ],
                ),
                if (e.registrationOpens != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${loc('Opens')}: ${fmt(opens)}',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
                if (e.registrationDeadline != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${loc('Deadline')}: ${fmt(deadline)}',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            // Primary action button — NO-OP for now (per your instruction)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ButtonStyle(
                  backgroundColor: WidgetStatePropertyAll(theme.primaryColor),
                  foregroundColor: WidgetStatePropertyAll(Colors.white),
                ),

                onPressed: () async {
                  // Open the full registration/payment page
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder:
                          (_) => RegistrationPaymentPage(
                            event: e,
                            // instance id for this event occurrence
                            instanceId: e.id,
                            allowedPaymentOptions: e.paymentOptions,
                            onSuccess: (method, resp) async {
                              // Close the registration page and refresh this event
                              Navigator.of(context).pop();
                              await _loadDetails(e.id);
                            },
                            onError: (msg) {
                              ScaffoldMessenger.of(
                                context,
                              ).showSnackBar(SnackBar(content: Text(msg)));
                            },
                            // Allow managing family members from within the flow
                            onAddFamilyMember: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const FamilyMembersPage(),
                                ),
                              );
                              // RegistrationPaymentPage will call helper.refreshPeople()
                              // after this returns.
                            },
                          ),
                    ),
                  );
                },
                icon: const Icon(Icons.group_outlined, size: 18),
                label: Text(
                  e.hasRegistrations
                      ? loc('View Registration')
                      : loc('Register'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip({
    required String label,
    required Color bg,
    required Color fg,
    required IconData icon,
    required Color border,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final event = _event;
    final theme = Theme.of(context);
    final loc = LocalizationHelper.localize;

    return Scaffold(
      appBar: AppBar(
        title: Text(loc('Event details'), overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: loc('Share'),
            onPressed: _shareEvent,
            icon: const Icon(Icons.share_outlined),
          ),
          IconButton(
            tooltip: _isFav ? loc('Favorited') : loc('Favorite'),
            onPressed: _busyFav ? null : _toggleFavorite,
            icon: Icon(
              _isFav ? Icons.favorite : Icons.favorite_border,
              color: _isFav ? Colors.pinkAccent : theme.iconTheme.color,
            ),
          ),
        ],
      ),
      body:
          _isLoading
              ? const Center(child: CircularProgressIndicator())
              : event == null || _errorMessage != null
              ? _buildErrorBody(context)
              : _buildContent(context, event),
    );
  }

  Widget _buildErrorBody(BuildContext context) {
    final loc = LocalizationHelper.localize;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              loc('No event found'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              loc(
                'The event you’re looking for doesn’t exist anymore or isn’t available.',
              ),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(loc('Close')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, UserFacingEvent event) {
    final theme = Theme.of(context);
    final loc = LocalizationHelper.localize;
    final eventLoc = _locForEvent(event);

    final ministriesText = _formatMinistryNames(event.ministries, _ministries);
    final heroUrl = AssetHelper.getPublicUrl(event.imageId);

    final user = FirebaseAuth.instance.currentUser;
    final showTicketCard = user != null && event.hasRegistrations;

    return Column(
      children: [
        // HERO IMAGE with layered effect: sharp foreground + blurred background
        Container(
          color: Colors.black,
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child:
                heroUrl.isNotEmpty
                    ? Stack(
                      fit: StackFit.expand,
                      children: [
                        // Blurred background image layer (zoomed in)
                        ImageFiltered(
                          imageFilter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
                          child: Transform.scale(
                            scale: 1.0, // Adjustable: 1.0 = 100% zoom (default)
                            child: Image.network(
                              heroUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                color: Colors.black,
                              ),
                            ),
                          ),
                        ),
                        // Sharp foreground image layer
                        Image.network(
                          heroUrl,
                          fit: BoxFit.contain,
                          errorBuilder:
                              (_, _, _) => Container(
                                color: Colors.black,
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.event,
                                  size: 48,
                                  color: Colors.white70,
                                ),
                              ),
                        ),
                      ],
                    )
                    : Container(
                      color: Colors.black,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.event,
                        size: 48,
                        color: Colors.white70,
                      ),
                    ),
          ),
        ),

        if (_shareMsg != null)
          Container(
            width: double.infinity,
            color: const Color(0xFFECFDF5),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              _shareMsg!,
              style: const TextStyle(color: Color(0xFF047857), fontSize: 12),
            ),
          ),

        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // TITLE + MINISTRIES + DESCRIPTION
                Text(
                  eventLoc.title.isNotEmpty
                      ? eventLoc.title
                      : loc('(Untitled Event)'),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (ministriesText != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.church_outlined, size: 18),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          ministriesText,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.textTheme.bodyMedium?.color
                                ?.withValues(alpha: 0.8),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (eventLoc.description.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    eventLoc.description,
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ],
                const SizedBox(height: 12),

                // MAIN CARD GRID (stack on mobile; can be two columns on wide)
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth >= 720;
                    if (!isWide) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildScheduleCard(event),
                          _buildAllowedAttendanceCard(event),
                          _buildPricingCard(event),
                          _buildCapacityCard(event),
                          _buildRegistrationCard(event),
                          if (showTicketCard) ...[
                            const SizedBox(height: 4),
                            EventTicketCard(instance: event, userId: user.uid),
                          ],
                        ],
                      );
                    }

                    // wide layout – two columns
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildScheduleCard(event),
                              _buildAllowedAttendanceCard(event),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          flex: 1,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildPricingCard(event),
                              _buildCapacityCard(event),
                              _buildRegistrationCard(event),
                              if (showTicketCard) ...[
                                const SizedBox(height: 4),
                                EventTicketCard(
                                  instance: event,
                                  userId: user.uid,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),

                const SizedBox(height: 16),

                // MAP CARD
                EventMapCard(
                  locationInfo: eventLoc.locationInfo,
                  locationAddress: event.locationAddress,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
