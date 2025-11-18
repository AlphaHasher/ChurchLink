// lib/helpers/event_user_helper.dart

import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/models/ministry.dart';
import 'package:app/firebase/firebase_auth_service.dart';

/// Helper for user-facing event APIs:
/// - Upcoming events (public vs private based on auth)
/// - "My events"
/// - Favorites
/// - Event instance details
///
/// Mirrors EventUserHelper.tsx semantics.
class EventUserHelper {
  // ---------------------------------------------------------------------------
  // Auth + endpoints
  // ---------------------------------------------------------------------------

  static bool get isSignedIn {
    try {
      return FirebaseAuthService().getCurrentUser() != null;
    } catch (_) {
      return false;
    }
  }

  static String _endpointFor(bool signedIn) {
    return signedIn
        ? '/v1/events/upcoming-private'
        : '/v1/events/upcoming-public';
  }

  static String _detailsEndpointFor(bool signedIn) {
    return signedIn
        ? '/v1/events/private-event-instance-details'
        : '/v1/events/public-event-instance-details';
  }

  /// Expose current list endpoint (mainly helpful for debugging / logging).
  static String get userEventsEndpoint => _endpointFor(isSignedIn);

  /// Expose current details endpoint.
  static String get eventDetailsEndpoint => _detailsEndpointFor(isSignedIn);

  // ---------------------------------------------------------------------------
  // Query builders (mirror TS buildQuery / buildMyEventsQuery)
  // ---------------------------------------------------------------------------

  /// Build query map for upcoming events (user events) with:
  /// - ministries joined into comma-separated string
  /// - preferred_lang from params or LocalizationHelper.currentLocale
  /// - null/empty values stripped
  static Map<String, dynamic> _buildUserEventsQuery(
    UserEventSearchParams params, {
    String? preferredLangFromHook,
  }) {
    // Start from the model's JSON (so we don't duplicate field wiring)
    final Map<String, dynamic> raw = params.toJson();

    // Ministries: convert array => comma-separated string to match TS/web.
    final ministries = raw['ministries'];
    if (ministries is List && ministries.isNotEmpty) {
      raw['ministries'] = ministries.map((e) => e.toString()).join(',');
    } else {
      raw.remove('ministries');
    }

    final String? paramLang = (raw['preferred_lang'] as String?)?.trim();
    final String? hookLang = preferredLangFromHook?.trim();

    final String? langToUse =
        (paramLang != null && paramLang.isNotEmpty)
            ? paramLang
            : (hookLang != null && hookLang.isNotEmpty)
            ? hookLang
            : null;

    if (langToUse != null && langToUse.isNotEmpty) {
      raw['preferred_lang'] = langToUse;
    } else {
      raw.remove('preferred_lang');
    }

    // Strip null / empty-string values
    raw.removeWhere((key, value) {
      if (value == null) return true;
      if (value is String && value.trim().isEmpty) return true;
      return false;
    });

    return raw;
  }

  /// Build query map for "my events" search with:
  /// - preferred_lang from params or LocalizationHelper.currentLocale
  /// - null/empty values stripped
  static Map<String, dynamic> _buildMyEventsQuery(
    MyEventsSearchParams params, {
    String? preferredLangFromHook,
  }) {
    final Map<String, dynamic> raw = params.toJson();

    final String? paramLang = (raw['preferred_lang'] as String?)?.trim();
    final String? hookLang = preferredLangFromHook?.trim();

    final String? langToUse =
        (paramLang != null && paramLang.isNotEmpty)
            ? paramLang
            : (hookLang != null && hookLang.isNotEmpty)
            ? hookLang
            : null;

    if (langToUse != null && langToUse.isNotEmpty) {
      raw['preferred_lang'] = langToUse;
    } else {
      raw.remove('preferred_lang');
    }

    raw.removeWhere((key, value) {
      if (value == null) return true;
      if (value is String && value.trim().isEmpty) return true;
      return false;
    });

    return raw;
  }

  // ---------------------------------------------------------------------------
  // Fetch upcoming events (user-facing)
  // ---------------------------------------------------------------------------

  /// Fetches upcoming events from the proper endpoint, using:
  /// - `/v1/events/upcoming-private` if signed in
  /// - `/v1/events/upcoming-public` if not
  ///
  /// Applies convertUserFacingEventsToUserTime on items.
  static Future<UserEventResults> fetchUserEvents(
    UserEventSearchParams params,
  ) async {
    final signedIn = isSignedIn;
    final endpoint = _endpointFor(signedIn);
    final langCode = LocalizationHelper.currentLocale;

    final query = _buildUserEventsQuery(
      params,
      preferredLangFromHook: langCode,
    );

    try {
      final res = await api.get(endpoint, queryParameters: query);

      final data = res.data;
      if (data is! Map<String, dynamic>) {
        return UserEventResults(
          items: const <UserFacingEvent>[],
          nextCursor: null,
        );
      }

      final itemsRaw = data['items'];
      if (itemsRaw is! List) {
        return UserEventResults(
          items: const <UserFacingEvent>[],
          nextCursor: null,
        );
      }

      // Normalize list into List<Map<String,dynamic>>
      final List<Map<String, dynamic>> itemMaps =
          itemsRaw
              .whereType<Map>()
              .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e),
              )
              .toList();

      final convertedMaps = convertUserFacingEventsToUserTime(itemMaps);

      final items =
          convertedMaps
              .map<UserFacingEvent>((m) => UserFacingEvent.fromJson(m))
              .toList();

      final nextCursorRaw = data['next_cursor'];
      EventsCursor? nextCursor;
      if (nextCursorRaw is Map<String, dynamic>) {
        nextCursor = EventsCursor.fromJson(
          Map<String, dynamic>.from(nextCursorRaw),
        );
      } else {
        nextCursor = null;
      }

      return UserEventResults(items: items, nextCursor: nextCursor);
    } catch (e, st) {
      logger.e(
        "[EventUserHelper] fetchUserEvents() -> error",
        error: e,
        stackTrace: st,
      );
      return UserEventResults(
        items: const <UserFacingEvent>[],
        nextCursor: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch "my events"
  // ---------------------------------------------------------------------------

  /// Fetches the authenticated user's events from `/v1/events/search-my-events`.
  /// This mirrors the plain TS function (no hooks).
  static Future<MyEventsResults> fetchMyEvents(
    MyEventsSearchParams params,
  ) async {
    final langCode = LocalizationHelper.currentLocale;
    final query = _buildMyEventsQuery(params, preferredLangFromHook: langCode);

    try {
      final res = await api.get(
        '/v1/events/search-my-events',
        queryParameters: query,
      );

      final data = res.data;
      if (data is! Map<String, dynamic>) {
        return MyEventsResults(
          items: const <UserFacingEvent>[],
          nextCursor: null,
        );
      }

      final itemsRaw = data['items'];
      if (itemsRaw is! List) {
        return MyEventsResults(
          items: const <UserFacingEvent>[],
          nextCursor: null,
        );
      }

      final List<Map<String, dynamic>> itemMaps =
          itemsRaw
              .whereType<Map>()
              .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e),
              )
              .toList();

      final convertedMaps = convertUserFacingEventsToUserTime(itemMaps);

      final items =
          convertedMaps
              .map<UserFacingEvent>((m) => UserFacingEvent.fromJson(m))
              .toList();

      final nextCursorRaw = data['next_cursor'];
      EventsCursor? nextCursor;
      if (nextCursorRaw is Map<String, dynamic>) {
        nextCursor = EventsCursor.fromJson(
          Map<String, dynamic>.from(nextCursorRaw),
        );
      } else {
        nextCursor = null;
      }

      return MyEventsResults(items: items, nextCursor: nextCursor);
    } catch (e, st) {
      logger.e(
        "[EventUserHelper] fetchMyEvents() -> error",
        error: e,
        stackTrace: st,
      );
      return MyEventsResults(
        items: const <UserFacingEvent>[],
        nextCursor: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------

  static Future<bool> favoriteEvent(String eventId) async {
    if (eventId.isEmpty) return false;
    try {
      final safeId = Uri.encodeComponent(eventId);
      await api.put('/v1/events/add-favorite/$safeId');
      return true;
    } catch (e, st) {
      logger.e(
        "[EventUserHelper] favoriteEvent() -> error",
        error: e,
        stackTrace: st,
      );
      return false;
    }
  }

  static Future<bool> unfavoriteEvent(String eventId) async {
    if (eventId.isEmpty) return false;
    try {
      final safeId = Uri.encodeComponent(eventId);
      await api.put('/v1/events/remove-favorite/$safeId');
      return true;
    } catch (e, st) {
      logger.e(
        "[EventUserHelper] unfavoriteEvent() -> error",
        error: e,
        stackTrace: st,
      );
      return false;
    }
  }

  static Future<bool> setFavorite(String eventId, bool makeFavorite) {
    return makeFavorite ? favoriteEvent(eventId) : unfavoriteEvent(eventId);
  }

  // ---------------------------------------------------------------------------
  // Event instance details
  // ---------------------------------------------------------------------------

  /// Fetch details for a specific event instance, using:
  /// - `/v1/events/private-event-instance-details/:id` if signed in
  /// - `/v1/events/public-event-instance-details/:id` if not
  ///
  /// Applies:
  /// - convertUserFacingEventsToUserTime to `event_details`
  /// - convertSisterInstanceIdentifiersToUserTime to `sister_details`
  static Future<EventDetailsResponse> fetchEventInstanceDetails(
    String instanceId,
  ) async {
    if (instanceId.isEmpty) {
      return EventDetailsResponse(
        success: false,
        msg: 'No instance id',
        eventDetails: null,
        sisterDetails: const <SisterInstanceIdentifier>[],
        ministries: const <Ministry>[],
      );
    }

    final signedIn = isSignedIn;
    final base = _detailsEndpointFor(signedIn);
    final langCode = LocalizationHelper.currentLocale;

    try {
      final safeId = Uri.encodeComponent(instanceId);
      final res = await api.get(
        '$base/$safeId',
        queryParameters: <String, dynamic>{'preferred_lang': langCode},
      );

      final data = res.data;
      if (data is! Map<String, dynamic>) {
        return EventDetailsResponse(
          success: false,
          msg: 'Failed to load event details',
          eventDetails: null,
          sisterDetails: const <SisterInstanceIdentifier>[],
          ministries: const <Ministry>[],
        );
      }

      final map = Map<String, dynamic>.from(data);

      // event_details: normalize + run through time conversion
      final rawDetails = map['event_details'];
      if (rawDetails is Map) {
        final detailsMap = Map<String, dynamic>.from(rawDetails);
        final convertedList = convertUserFacingEventsToUserTime(
          <Map<String, dynamic>>[detailsMap],
        );
        if (convertedList.isNotEmpty) {
          map['event_details'] = convertedList.first;
        }
      }

      // sister_details: list of identifiers
      final rawSisters = map['sister_details'];
      if (rawSisters is List) {
        final sisterMaps =
            rawSisters
                .whereType<Map>()
                .map<Map<String, dynamic>>(
                  (e) => Map<String, dynamic>.from(e),
                )
                .toList();
        final convertedSisters = convertSisterInstanceIdentifiersToUserTime(
          sisterMaps,
        );
        map['sister_details'] = convertedSisters;
      }

      return EventDetailsResponse.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[EventUserHelper] fetchEventInstanceDetails() -> error",
        error: e,
        stackTrace: st,
      );
      return EventDetailsResponse(
        success: false,
        msg: 'Failed to load event details',
        eventDetails: null,
        sisterDetails: const <SisterInstanceIdentifier>[],
        ministries: const <Ministry>[],
      );
    }
  }
}
