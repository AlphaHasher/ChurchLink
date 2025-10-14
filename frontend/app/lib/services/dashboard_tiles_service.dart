import 'dart:convert';
import 'package:http/http.dart' as http;

// Service for obtaining the Dashboard tile backgrounds from Strapi
class DashboardTilesService {
  DashboardTilesService(this.baseUrl);
  final String baseUrl;

  // Use a cache so the backgrounds aren't refreshed too often
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

  Future<Map<String, String>> fetchImageUrls({bool forceRefresh = false}) async {
    if (!forceRefresh && _isFresh()) {
      return _cache!;
    }

    final uri = Uri.parse(
      '$baseUrl/api/dashboard-tiles'
      '?populate=backgroundImage'
      '&filters[enabled][\$eq]=true'
      '&pagination[pageSize]=100'
    );

    final res = await http.get(uri);
    if (res.statusCode != 200) {
      throw Exception('Tiles fetch failed: ${res.statusCode}');
    }

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final List data = (body['data'] as List?) ?? const [];

    String? toAbs(String? url) {
      if (url == null || url.isEmpty) return null;
      if (url.startsWith('http')) return url;
      final needsSlash = !baseUrl.endsWith('/') && !url.startsWith('/');
      return needsSlash ? '$baseUrl/$url' : '$baseUrl$url';
    }

    String? extractImageUrl(dynamic bg) {
      // v5-flat
      if (bg is Map<String, dynamic> && bg.containsKey('url')) {
        return bg['formats']?['small']?['url'] as String? ??
            bg['formats']?['thumbnail']?['url'] as String? ??
            bg['url'] as String?;
      }
      // v4-nested
      final data = (bg is Map) ? bg['data'] : null;
      final attrs = (data is Map) ? data['attributes'] as Map<String, dynamic>? : null;
      if (attrs != null) {
        return attrs['formats']?['small']?['url'] as String? ??
            attrs['formats']?['thumbnail']?['url'] as String? ??
            attrs['url'] as String?;
      }
      return null;
    }

    final map = <String, String>{};
    for (final item in data) {
      final obj = (item as Map<String, dynamic>);
      final attrs = (obj['attributes'] as Map<String, dynamic>?) ?? obj; // v4 or v5
      final slug = (attrs['slug'] ?? '').toString();
      final bg = attrs['backgroundImage'];
      final url = toAbs(extractImageUrl(bg));
      if (slug.isNotEmpty && url != null) {
        map[slug] = url;
      }
    }

    _cache = map;
    _cacheAt = DateTime.now();
    return map;
  }
}
