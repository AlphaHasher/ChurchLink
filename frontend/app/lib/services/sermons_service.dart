import 'package:dio/dio.dart';

import 'package:app/helpers/api_client.dart';
import 'package:app/models/sermon.dart';
import 'package:app/models/sermon_filter.dart';

class SermonsService {
  SermonsService({Dio? client}) : _client = client ?? api;

  final Dio _client;

  /// Fetch paginated sermons using the provided filter.
  Future<List<Sermon>> fetchSermons(SermonFilter filter) async {
    try {
      final hasQuery = filter.query != null && filter.query!.isNotEmpty;
      final endpoint = hasQuery ? '/v1/sermons/search' : '/v1/sermons/';
      
      final params = filter.toQueryParameters();
      if (hasQuery) {
        params.remove('date_after');
        params.remove('date_before');
      }
      
      final response = await _client.get<dynamic>(
        endpoint,
        queryParameters: params,
      );

      final data = response.data;

      if (data is List) {
        return data
            .whereType<Map<String, dynamic>>()
            .map(Sermon.fromJson)
            .toList();
      }

      return _coerceFromEnvelope(data);
    } on DioException catch (error) {
      throw Exception('Failed to load sermons: ${error.message}');
    }
  }

  /// Fetch a single sermon by identifier.
  Future<Sermon?> fetchSermonById(String id) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/v1/sermons/$id',
      );
      if (response.data == null) return null;
      return Sermon.fromJson(response.data!);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      throw Exception('Failed to load sermon $id: ${error.message}');
    }
  }

  /// Mark the sermon as a favorite for the current user.
  Future<void> favorite(String id) async {
    try {
      final response = await _client.post('/v1/sermons/$id/favorite');
      if (response.statusCode == null ||
          response.statusCode! < 200 ||
          response.statusCode! >= 300) {
        if (response.statusCode == 401) {
          throw Exception('AUTH_REQUIRED');
        }
        throw Exception('Unexpected status code: ${response.statusCode}');
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        throw Exception('AUTH_REQUIRED');
      }
      throw Exception('Failed to favorite sermon $id: ${error.message}');
    }
  }

  /// Remove the sermon from the current user's favorites.
  Future<void> unfavorite(String id) async {
    try {
      final response = await _client.delete('/v1/sermons/$id/favorite');
      if (response.statusCode == null ||
          response.statusCode! < 200 ||
          response.statusCode! >= 300) {
        throw Exception('Unexpected status code: ${response.statusCode}');
      }
    } on DioException catch (error) {
      throw Exception('Failed to unfavorite sermon $id: ${error.message}');
    }
  }

  /// Convenience helper to run a search without mutating the original filter.
  Future<List<Sermon>> search(String query, {SermonFilter? filter}) {
    final effectiveFilter = (filter ?? const SermonFilter()).copyWith(
      query: query,
    );
    return fetchSermons(effectiveFilter);
  }

  List<Sermon> _coerceFromEnvelope(dynamic data) {
    if (data is Map<String, dynamic>) {
      final candidates = data['items'] ?? data['results'] ?? data['data'];
      if (candidates is List) {
        return candidates
            .whereType<Map<String, dynamic>>()
            .map(Sermon.fromJson)
            .toList();
      }
    }
    return <Sermon>[];
  }
}

