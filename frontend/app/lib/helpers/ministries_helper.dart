// lib/helpers/ministries_helper.dart

import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/ministry.dart';

class MinistriesHelper {
  /// Fetch canonical ministries list.
  static Future<List<Ministry>> fetchMinistries() async {
    try {
      final res = await api.get('/v1/ministries');
      final data = res.data;

      if (data is! List) {
        logger.w(
          '[MinistriesHelper] fetchMinistries() -> unexpected payload type: ${data.runtimeType}',
        );
        return <Ministry>[];
      }

      final List<Map<String, dynamic>> raw =
          data
              .whereType<Map>()
              .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e),
              )
              .toList();

      final converted = convertMinistryToUserTime(raw);

      return converted.map<Ministry>((m) => Ministry.fromJson(m)).toList();
    } catch (e, st) {
      logger.e(
        '[MinistriesHelper] fetchMinistries() -> error',
        error: e,
        stackTrace: st,
      );
      return <Ministry>[];
    }
  }

  /// Fetch ministries as a string list of names.
  static Future<List<String>> fetchMinistriesAsStringArray() async {
    try {
      final res = await api.get('/v1/ministries');
      final data = res.data;

      if (data is! List) {
        logger.w(
          '[MinistriesHelper] fetchMinistriesAsStringArray() -> unexpected payload type: ${data.runtimeType}',
        );
        return <String>[];
      }

      final List<Map<String, dynamic>> raw =
          data
              .whereType<Map>()
              .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e),
              )
              .toList();

      final converted = convertMinistryToUserTime(raw);

      return converted
          .map<String>((m) => (m['name'] ?? '').toString().trim())
          .where((s) => s.isNotEmpty)
          .toList();
    } catch (e, st) {
      logger.e(
        '[MinistriesHelper] fetchMinistriesAsStringArray() -> error',
        error: e,
        stackTrace: st,
      );
      return <String>[];
    }
  }

  /// Build an id -> name lookup map from a ministries array.
  static Map<String, String> buildMinistryNameMap(List<Ministry> ministries) {
    final map = <String, String>{};

    for (final m in ministries) {
      if (m.id.isEmpty) continue;
      final name = (m.name).toString().trim();
      if (name.isNotEmpty) {
        map[m.id] = name;
      }
    }

    return map;
  }
}
