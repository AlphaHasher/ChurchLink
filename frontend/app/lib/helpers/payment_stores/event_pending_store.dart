import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:app/models/event_v2.dart';

class EventPendingStore {
  static String _pendingKey(String instanceId, String orderId) =>
      'paypal-final:$instanceId:$orderId';

  static Future<void> savePending({
    required String instanceId,
    required String orderId,
    required RegistrationDetails details,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = jsonEncode(details.toJson());
      await prefs.setString(_pendingKey(instanceId, orderId), json);
    } catch (_) {
      // Best-effort only. If this fails, success page will show an error.
    }
  }

  static Future<RegistrationDetails?> loadPending({
    required String instanceId,
    required String orderId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_pendingKey(instanceId, orderId));
      if (raw == null || raw.isEmpty) return null;

      final map = jsonDecode(raw);
      if (map is! Map<String, dynamic>) return null;
      return RegistrationDetails.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearPending({
    required String instanceId,
    required String orderId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_pendingKey(instanceId, orderId));
    } catch (_) {
      // Ignore
    }
  }
}
