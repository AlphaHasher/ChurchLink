import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Local cache of pending form submissions tied to a PayPal order.
///
/// This is the mobile analogue of the web's localStorage "form_data_{slug}"
/// usage: we store the user's answers so that after PayPal approval we can
/// call capture-and-submit with the exact same data, even if the page was
/// temporarily left.
class FormPendingStore {
  FormPendingStore._();

  static String _key(String slug, String orderId) =>
      'form-final:$slug:$orderId';

  /// Save the pending form answers for a given (slug, orderId) pair.
  static Future<void> savePending({
    required String slug,
    required String orderId,
    required Map<String, dynamic> answers,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = jsonEncode(answers);
      await prefs.setString(_key(slug, orderId), json);
    } catch (_) {
      // Best-effort only; if this fails, the capture flow will fall back
      // to whatever data the caller still has in memory.
    }
  }

  /// Load previously-saved answers for a given (slug, orderId) pair.
  ///
  /// Returns null if nothing is stored or parsing fails.
  static Future<Map<String, dynamic>?> loadPending({
    required String slug,
    required String orderId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key(slug, orderId));
      if (raw == null || raw.isEmpty) return null;

      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;

      return Map<String, dynamic>.from(decoded);
    } catch (_) {
      return null;
    }
  }

  /// Remove any cached answers for this (slug, orderId).
  static Future<void> clearPending({
    required String slug,
    required String orderId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_key(slug, orderId));
    } catch (_) {
      // Ignore
    }
  }
}
