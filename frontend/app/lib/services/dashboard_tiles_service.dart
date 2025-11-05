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
  static const Duration _ttl = Duration(hours: 6); // Cache life
  static List<String>? _orderCache;
  static Map<String, String>? _namesCache;

  static void invalidateCache() {
    _cache = null;
    _cacheAt = null;
    _orderCache = null;
    _namesCache = null;
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
  Future<Map<String, String>> fetchImageUrls({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _isFresh()) return _cache!;

    // Return the base URL with the path appended
    final uri = _u('/app/dashboard/pages');
    debugPrint('Dashboard GET => $uri');

    final res = await http.get(uri).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) {
      if (_cache != null) return _cache!;
      throw Exception(
        'Tiles fetch failed: ${res.statusCode} (${res.request?.url})',
      );
    }

    final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
    final map = <String, String>{};

    // Iterate for each item
    for (final m in list) {
      // Skip disabled items (default to true if missing)
      final enabled = m['enabled'] is bool ? m['enabled'] as bool : true;
      if (!enabled) continue;

      // Prefer pageName; fall back to displayName
      final rawName =
          (m['pageName'] as String?) ?? (m['displayName'] as String?) ?? '';
      final name = rawName.trim();
      if (name.isEmpty) continue;

      // Normalize the names of the page
      final key = _norm(name);

      // Builds a URL with the matching Image ID of the provided page
      final imageId = (m['imageId'] as String?)?.trim();
      map[key] =
          (imageId != null && imageId.isNotEmpty)
              ? _img(imageId, thumbnail: true)
              : '';
    }

    _cache = map;
    _cacheAt = DateTime.now();
    return map;
  }

  /// Returns a list of the enabled pages in order
  /// Functions similarly to the previously used fetchImageUrls
  Future<List<String>> fetchOrderedSlugs({bool forceRefresh = false}) async {
    // Use the cache if still new
    final fresh =
        _orderCache != null &&
        _cacheAt != null &&
        DateTime.now().difference(_cacheAt!) < _ttl;
    if (!forceRefresh && fresh) return _orderCache!;

    // Return the base URL with the path appended
    final uri = _u('/app/dashboard/pages');
    debugPrint('Dashboard GET => $uri');

    final res = await http.get(uri).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) {
      if (_orderCache != null) return _orderCache!;
      throw Exception(
        'Order fetch failed: ${res.statusCode} (${res.request?.url})',
      );
    }

    // List of the pages
    final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();

    // Compile the list of enabled pages and normalize the names
    final rows = <Map<String, dynamic>>[];
    for (final m in list) {
      final enabled = m['enabled'] is bool ? m['enabled'] as bool : true;
      if (!enabled) continue;

      final pageName = (m['pageName'] as String?) ?? '';
      final display = (m['displayName'] as String?) ?? '';
      final rawName = (pageName.isNotEmpty ? pageName : display).trim();
      if (rawName.isEmpty) continue;

      rows.add({
        'slug': _norm(rawName),
        'index': m['index'] is int ? m['index'] : 0,
      });
    }

    // Sort the entries
    rows.sort((a, b) => (a['index'] as int).compareTo(b['index'] as int));

    final slugs = rows.map((r) => r['slug'] as String).toList();

    _orderCache = slugs;
    _cacheAt = DateTime.now();
    return slugs;
  }

  /// Return slug and display name pairings
  Future<Map<String, String>> fetchDisplayNames({
    bool forceRefresh = false,
  }) async {
    final fresh =
        _namesCache != null &&
        _cacheAt != null &&
        DateTime.now().difference(_cacheAt!) < _ttl;
    if (!forceRefresh && fresh) return _namesCache!;

    final uri = _u('/app/dashboard/pages');
    debugPrint('Dashboard GET => $uri');

    final res = await http.get(uri).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) {
      if (_namesCache != null) return _namesCache!;
      throw Exception(
        'Names fetch failed: ${res.statusCode} (${res.request?.url})',
      );
    }

    final list = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
    final map = <String, String>{};

    for (final m in list) {
      final enabled = m['enabled'] is bool ? m['enabled'] as bool : true;
      if (!enabled) continue;

      final pageName = (m['pageName'] as String?)?.trim() ?? '';
      final display = (m['displayName'] as String?)?.trim() ?? '';

      // If both are empty, skip the entry entirely
      if (pageName.isEmpty && display.isEmpty) continue;

      // Slug is based on pageName when available (stable), else display
      final slug = _norm(pageName.isNotEmpty ? pageName : display);

      // Store the display text as-is (may be empty) so the app can intentionally show no title
      map[slug] = display;
    }

    _namesCache = map;
    _cacheAt = DateTime.now();
    return map;
  }
}
