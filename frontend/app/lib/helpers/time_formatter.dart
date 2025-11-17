// time_formatter.dart
//
// Port of TimeFormatter.tsx to Dart + timezone package.
//
// Requires:
//   timezone: ^0.10.1
// And early app init:
//   import 'package:timezone/data/latest.dart' as tzdata;
//   tzdata.initializeTimeZones();
//
// ADMIN_TZ is read from a compile-time env var:
//   flutter run --dart-define=ADMIN_TZ=Europe/Berlin
// If unset/blank, it falls back to "America/Los_Angeles".

import 'package:timezone/timezone.dart' as tz;

typedef MaybeISO = String?;
typedef JsonMap = Map<String, dynamic>;

// Default admin timezone (matches TS default)
const String _defaultAdminTimeZone = 'America/Los_Angeles';

// Raw env var; may be empty if not provided.
const String _envAdminTz = String.fromEnvironment('ADMIN_TZ', defaultValue: '');

/// Effective admin timezone for DST logic & conversions.
final String ADMIN_TZ =
    _envAdminTz.trim().isNotEmpty ? _envAdminTz.trim() : _defaultAdminTimeZone;

// ---------------------------------------------------------------------------
// Core helpers (ISO parsing, canonicalization)
// ---------------------------------------------------------------------------

/// Returns a specifically UTC ISO string if no timezone is specified.
/// If the input already has a zone marker (Z or ±hh:mm), it is returned.
/// Null/empty input yields null.
String? assumeUTCIfNaive(MaybeISO iso) {
  if (iso == null || iso.isEmpty) return null;
  final s = iso;
  final tzRegex = RegExp(r'[zZ]|[+\-]\d{2}:\d{2}$');
  if (tzRegex.hasMatch(s)) return s;
  return '${s}Z';
}

/// Creates a DateTime (UTC) from an ISO string. Returns null if invalid.
DateTime? dateFromISO(MaybeISO iso) {
  final norm = assumeUTCIfNaive(iso);
  if (norm == null) return null;
  try {
    return DateTime.parse(norm).toUtc();
  } catch (_) {
    return null;
  }
}

/// Converts a UTC ISO (or naive) to a canonical UTC ISO string.
/// If parsing fails, returns the original value (or null).
MaybeISO toZonedISOString(MaybeISO utcISO) {
  final d = dateFromISO(utcISO);
  return d != null ? d.toIso8601String() : utcISO ?? null;
}

/// Safely parse a date/time string that might be either:
/// - an en-US local string like "11/13/2025, 5:47:00 PM" produced by
///   convertTime / convertUserFacingEventsToUserTime, OR
/// - a raw ISO string from the backend.
///
/// Returns a DateTime in the **device's local time zone**, or null
/// if parsing fails.
DateTime? safeParseIsoLocal(String? value) {
  if (value == null) return null;
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;

  // First try the en-US admin-tz format ("M/D/YYYY, H:MM[:SS] AM/PM").
  final isoFromEn = localeEnUsToIsoInAdminTz(trimmed);
  if (isoFromEn != null) {
    try {
      return DateTime.parse(isoFromEn).toLocal();
    } catch (_) {
      // fall through to raw ISO parse
    }
  }

  // Fallback: treat it as an ISO string, assuming UTC if it's naive.
  final norm = assumeUTCIfNaive(trimmed);
  if (norm == null) return null;
  try {
    return DateTime.parse(norm).toLocal();
  } catch (_) {
    return null;
  }
}

/// Formats a date/time range for display on the event card.
///
/// Examples:
/// - Single instant:
///   "Nov 16, 2025 · 5:00 PM"
/// - Same day range:
///   "Nov 16, 2025 · 5:00–7:00 PM"
/// - Multi-day:
///   "Nov 16, 2025 – Nov 18, 2025"
String formatDateRangeForDisplay(DateTime start, DateTime? end) {
  String monthName(int m) =>
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

  String dayPart(DateTime d) => '${monthName(d.month)} ${d.day}, ${d.year}';

  String timePart(DateTime d) {
    var hour = d.hour;
    final minute = d.minute;
    final isPm = hour >= 12;
    var h12 = hour % 12;
    if (h12 == 0) h12 = 12;
    final mm = minute.toString().padLeft(2, '0');
    final suffix = isPm ? 'PM' : 'AM';
    return '$h12:$mm $suffix';
  }

  // No end or identical instants -> single timestamp.
  if (end == null || !end.isAfter(start)) {
    return '${dayPart(start)} · ${timePart(start)}';
  }

  final sameDay =
      start.year == end.year &&
      start.month == end.month &&
      start.day == end.day;

  if (sameDay) {
    // Same day: "Nov 16, 2025 · 5:00–7:00 PM"
    return '${dayPart(start)} · ${timePart(start)}–${timePart(end)}';
  }

  // Multi-day: "Nov 16, 2025 – Nov 18, 2025"
  return '${dayPart(start)} – ${dayPart(end)}';
}

// ---------------------------------------------------------------------------
// Timezone helpers (timezone package)
// ---------------------------------------------------------------------------

tz.Location _getLocation(String timeZone) {
  final primaryName = timeZone.trim().isNotEmpty ? timeZone.trim() : ADMIN_TZ;

  try {
    return tz.getLocation(primaryName);
  } catch (_) {
    // Try fallback (TS default)
    try {
      return tz.getLocation(_defaultAdminTimeZone);
    } catch (_) {
      // Absolute last resort: UTC
      return tz.UTC;
    }
  }
}

/// Returns the offset in minutes between local time in [timeZone] and UTC
/// at the given UTC instant. Positive => local ahead of UTC, negative => behind.
int _zoneOffsetMinutes(DateTime utcInstant, String timeZone) {
  final loc = _getLocation(timeZone);
  final local = tz.TZDateTime.from(utcInstant.toUtc(), loc);
  return local.timeZoneOffset.inMinutes;
}

// ---------------------------------------------------------------------------
// DST & conversion logic (mirrors TS implementation)
// ---------------------------------------------------------------------------

/// Returns true if the given UTC instant falls within Daylight Saving Time
/// for the specified IANA timezone. Mirrors the TS logic using Jan/Jul offsets.
bool isDstAt(String utcIso, String timeZone) {
  final norm = assumeUTCIfNaive(utcIso);
  if (norm == null) return false;

  DateTime utc;
  try {
    utc = DateTime.parse(norm).toUtc();
  } catch (_) {
    return false;
  }

  int offsetFor(DateTime d) => _zoneOffsetMinutes(d, timeZone);

  final year = utc.year;
  final jan = DateTime.utc(year, 1, 1, 0, 0, 0);
  final jul = DateTime.utc(year, 7, 1, 0, 0, 0);

  final janOff = offsetFor(jan);
  final julOff = offsetFor(jul);

  // If offsets match, the zone doesn't observe DST this year
  if (janOff == julOff) return false;

  // Infer hemisphere: in northern zones, Jan has standard time;
  // in southern, Jul has standard time.
  final northernHemisphere = janOff < julOff;
  final standardOffset = northernHemisphere ? janOff : julOff;

  // If the current offset differs from the inferred standard offset, we're in DST.
  final currentOffset = offsetFor(utc);
  return currentOffset != standardOffset;
}

/// Converts an event time based on an anchor time, compensating for DST
/// transitions in the admin timezone.
///
/// eventTime: when the event instance actually occurs.
/// anchorTime: a "truth" time representing user intention (e.g. original series
///             time).
///
/// Semantics:
/// - If event is DST and anchor is not → delta = -1 hour.
/// - If anchor is DST and event is not → delta = +1 hour.
/// - Returns an "en-US" wall-time string in ADMIN_TZ, like:
///   "11/13/2025, 5:47:00 PM".
String? convertTime(MaybeISO eventTime, MaybeISO anchorTime) {
  final tzName = ADMIN_TZ;

  final event = dateFromISO(eventTime);
  final utcEvent = assumeUTCIfNaive(eventTime);
  final utcAnchor = assumeUTCIfNaive(anchorTime);

  if (event == null || utcEvent == null || utcAnchor == null) {
    return eventTime;
  }

  final isEventDst = isDstAt(utcEvent, tzName);
  final isAnchorDst = isDstAt(utcAnchor, tzName);

  var deltaHours = 0;
  if (isEventDst && !isAnchorDst) {
    deltaHours = -1;
  } else if (!isEventDst && isAnchorDst) {
    deltaHours = 1;
  }

  final adjustedUtc = event.toUtc().add(Duration(hours: deltaHours));

  final loc = _getLocation(tzName);
  final local = tz.TZDateTime.from(adjustedUtc, loc);

  return _formatEnUsLocal(local);
}

/// Converts strings like "11/13/2025, 5:47:00 PM" (en-US, ADMIN_TZ wall time)
/// into a UTC ISO string (e.g. "2025-11-14T01:47:00.000Z").
/// Returns null if parsing fails.
String? localeEnUsToIsoInAdminTz(MaybeISO input) {
  if (input == null) return null;
  final s = input.trim();

  final re = RegExp(
    r'^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$',
    caseSensitive: false,
  );

  final match = re.firstMatch(s);
  if (match == null) return null;

  final month = int.parse(match.group(1)!);
  final day = int.parse(match.group(2)!);
  final year = int.parse(match.group(3)!);

  var hour = int.parse(match.group(4)!);
  final minute = int.parse(match.group(5)!);
  final second = match.group(6) != null ? int.parse(match.group(6)!) : 0;
  final ap = match.group(7)!;

  final isPm = ap.toUpperCase() == 'PM';
  if (isPm && hour < 12) hour += 12;
  if (!isPm && hour == 12) hour = 0;

  // Initial UTC guess assuming the wall-time values are UTC (they're not).
  final initialUtc = DateTime.utc(year, month, day, hour, minute, second);

  // Compute the timezone offset (in minutes) for ADMIN_TZ at that UTC instant.
  final offsetMin = _zoneOffsetMinutes(initialUtc, ADMIN_TZ);

  // True UTC instant is local wall-time minus the zone offset.
  final trueUtc = initialUtc.subtract(Duration(minutes: offsetMin));

  try {
    return trueUtc.toIso8601String();
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

String _twoDigits(int v) => v.toString().padLeft(2, '0');

/// Format a DateTime as: M/D/YYYY, H:MM:SS AM/PM (en-US style).
/// [dt] is assumed to already be in the desired local timezone.
String _formatEnUsLocal(DateTime dt) {
  final month = dt.month;
  final day = dt.day;
  final year = dt.year;

  var hour24 = dt.hour;
  final minute = dt.minute;
  final second = dt.second;

  final isPm = hour24 >= 12;
  var hour12 = hour24 % 12;
  if (hour12 == 0) hour12 = 12;

  final mm = _twoDigits(minute);
  final ss = _twoDigits(second);
  final suffix = isPm ? 'PM' : 'AM';

  return '$month/$day/$year, $hour12:$mm:$ss $suffix';
}

// ---------------------------------------------------------------------------
// Converter functions (JSON-level; mirror TS semantics)
// ---------------------------------------------------------------------------

String? _stringOrNull(dynamic v) {
  if (v == null) return null;
  if (v is String) return v;
  return v.toString();
}

/// Matches convertUserFacingEventsToUserTime<T> from TS.
List<JsonMap> convertUserFacingEventsToUserTime(List<JsonMap> items) {
  return items.map((e) {
    final result = Map<String, dynamic>.from(e);

    String? dateRef = _stringOrNull(e['event_date']);
    String? endDateRef = _stringOrNull(e['event_date']);
    String? opRef = _stringOrNull(e['event_date']);
    String? dlRef = _stringOrNull(e['event_date']);
    String? rdlRef = _stringOrNull(e['event_date']);

    final overrides = e['overrides_tracker'];
    if (overrides is List) {
      if (overrides.length > 3 && overrides[3] == true) {
        dateRef = _stringOrNull(e['date']);
        endDateRef = _stringOrNull(e['end_date']);
      }
      if (overrides.length > 4 && overrides[4] == true) {
        opRef = _stringOrNull(e['registration_opens']);
        dlRef = _stringOrNull(e['registration_deadline']);
        rdlRef = _stringOrNull(e['automatic_refund_deadline']);
      }
    }

    result['date'] = convertTime(_stringOrNull(e['date']), dateRef);
    result['end_date'] = convertTime(_stringOrNull(e['end_date']), endDateRef);
    result['registration_opens'] = convertTime(
      _stringOrNull(e['registration_opens']),
      opRef,
    );
    result['registration_deadline'] = convertTime(
      _stringOrNull(e['registration_deadline']),
      dlRef,
    );
    result['automatic_refund_deadline'] = convertTime(
      _stringOrNull(e['automatic_refund_deadline']),
      rdlRef,
    );

    result['updated_on'] = toZonedISOString(_stringOrNull(e['updated_on']));
    result['event_date'] = toZonedISOString(_stringOrNull(e['event_date']));
    result['overrides_date_updated_on'] = toZonedISOString(
      _stringOrNull(e['overrides_date_updated_on']),
    );

    return result;
  }).toList();
}

/// Matches convertSisterInstanceIdentifiersToUserTime<T> from TS.
List<JsonMap> convertSisterInstanceIdentifiersToUserTime(List<JsonMap> items) {
  return items.map((e) {
    final result = Map<String, dynamic>.from(e);
    result['date'] = convertTime(
      _stringOrNull(e['date']),
      _stringOrNull(e['event_date']),
    );
    result['updated_on'] = toZonedISOString(_stringOrNull(e['updated_on']));
    result['event_date'] = toZonedISOString(_stringOrNull(e['event_date']));
    return result;
  }).toList();
}

/// Matches convertTransactionSummaryToUserTime<T> from TS.
List<JsonMap> convertTransactionSummaryToUserTime(List<JsonMap> sums) {
  return sums.map((e) {
    final result = Map<String, dynamic>.from(e);
    result['created_at'] = toZonedISOString(_stringOrNull(e['created_at']));
    result['updated_at'] = toZonedISOString(_stringOrNull(e['updated_at']));
    return result;
  }).toList();
}

/// Alias: convertMinistryToUserTime = convertTransactionSummaryToUserTime
List<JsonMap> convertMinistryToUserTime(List<JsonMap> ministries) {
  return convertTransactionSummaryToUserTime(ministries);
}

/// Matches convertRefundRequestsToUserTime<T> from TS.
/// Expects each item to have:
///   transaction?: JsonMap | null,
///   created_on?: MaybeISO,
///   responded_to?: MaybeISO
List<JsonMap> convertRefundRequestsToUserTime(List<JsonMap> items) {
  return items.map((e) {
    final result = Map<String, dynamic>.from(e);

    final tx = e['transaction'];
    JsonMap? convertedTx;
    if (tx is Map<String, dynamic>) {
      final convertedList = convertTransactionSummaryToUserTime([tx]);
      convertedTx = convertedList.isNotEmpty ? convertedList.first : null;
    }

    result['transaction'] = convertedTx;
    result['created_on'] = toZonedISOString(_stringOrNull(e['created_on']));
    result['responded_to'] = toZonedISOString(_stringOrNull(e['responded_to']));

    return result;
  }).toList();
}
