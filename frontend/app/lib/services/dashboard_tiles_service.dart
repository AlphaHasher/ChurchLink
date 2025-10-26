import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Service for obtaining Dashboard tile image URLs from FastAPI,
class DashboardTilesService {
  DashboardTilesService(this.baseUrl);
  final String baseUrl;

  // Fix the API call by appending it
  static const String _prefix = '/api/v1';

  // Cache
  static Map<String, String>? _cache;
  static DateTime? _cacheAt;
  static const Duration _ttl = Duration(hours: 6);

  static void invalidateCache() {
    _cache = null;
    _cacheAt = null;
  }

  bool _isFresh() =>
      _cache != null &&
      _cacheAt != null &&
      DateTime.now().difference(_cacheAt!) < _ttl;

  // Build the URL pathing for a call by appending paths to the .env URL
  // Used to access the dashboard info and the images themselves
  // EX: call _u('/app/dashboard/pages')
  //     return http://10.0.2.2:8000/api/v1/app/dashboard/pages
  // EX: call _u('/assets/public/id/123')
  //     return http://10.0.2.2:8000/api/v1/assets/public/id/123
  Uri _u(String path) {
    String b = baseUrl;
    if (!b.endsWith('/')) b = '$b/';
    String p = _prefix;
    if (p.startsWith('/')) p = p.substring(1);
    if (!p.endsWith('/')) p = '$p/';
    String s = path.startsWith('/') ? path.substring(1) : path;
    return Uri.parse(b).resolve('$p$s');
  }

  // Normalize the page names, swapping dashes and underscores to spaces to match existing dashboard naming
  // EX: 'join live' -> 'join-live'
  String _norm(String s) => s
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), '-')
      .replaceAll('_', '-');

  // Build the URL for an image
  // Uses the page name and imageId pairing from the previously retrieved dashboard pages json
  // EX: call "_img('ABC123')"
  //     return "http://10.0.2.2:8000/api/v1/assets/public/id/ABC123?thumbnail=1"
  String _img(String id, {bool thumbnail = true}) {
    final t = thumbnail ? '?thumbnail=1' : '';
    return _u('/assets/public/id/$id').toString() + t;
  }

  /// Fetch image URLs from FastAPI:
  /// GET {baseUrl}/api/v1/app/dashboard/pages
  Future<Map<String, String>> fetchImageUrls({bool forceRefresh = false}) async {
    if (!forceRefresh && _isFresh()) return _cache!;

    // Retrieve the Dashboard structure from the backend
    final uri = _u('/app/dashboard/pages');
    debugPrint('Dashboard GET => $uri');

    final res = await http.get(uri).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) {
      if (_cache != null) return _cache!;
      throw Exception('Tiles fetch failed: ${res.statusCode} (${res.request?.url})');
    }

    final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
    final map = <String, String>{};

    // Iterate for each item
    for (final m in list) {
      // Skip disabled items (default to true if missing)
      final enabled = m['enabled'] is bool ? m['enabled'] as bool : true;
      if (!enabled) continue;

      // Prefer pageName; fall back to displayName
      final rawName = (m['pageName'] as String?) ?? (m['displayName'] as String?) ?? '';
      final name = rawName.trim();
      if (name.isEmpty) continue;

      // Normalize the names of the page
      final key = _norm(name);

      // Builds a URL with the matching Image ID of the provided page
      final imageId = (m['imageId'] as String?)?.trim();
      map[key] = (imageId != null && imageId.isNotEmpty)
          ? _img(imageId, thumbnail: true)
          : '';
    }

    _cache = map;
    _cacheAt = DateTime.now();
    return map;
  }
}
