import 'package:dio/dio.dart';

import 'package:app/helpers/api_client.dart';
import 'package:app/models/bulletin.dart';
import 'package:app/models/service_bulletin.dart';
import 'package:app/models/server_week.dart';

/// Response model for combined bulletin feed containing services and bulletins
class BulletinFeedResponse {
  final List<ServiceBulletin> services;
  final List<Bulletin> bulletins;

  const BulletinFeedResponse({required this.services, required this.bulletins});

  factory BulletinFeedResponse.fromJson(Map<String, dynamic> json) {
    final servicesData = json['services'] as List? ?? [];
    final bulletinsData = json['bulletins'] as List? ?? [];

    return BulletinFeedResponse(
      services:
          servicesData
              .whereType<Map<String, dynamic>>()
              .map(ServiceBulletin.fromJson)
              .toList(),
      bulletins:
          bulletinsData
              .whereType<Map<String, dynamic>>()
              .map(Bulletin.fromJson)
              .toList(),
    );
  }
}

class BulletinsService {
  BulletinsService({Dio? client}) : _client = client ?? api;

  final Dio _client;

  /// Fetch current week info from server (server-localized)
  Future<ServerWeekInfo> fetchCurrentWeek() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/v1/bulletins/current_week',
      );

      if (response.data != null) {
        return ServerWeekInfo.fromJson(response.data!);
      }
      
      // Fallback to client-side calculation
      return ServerWeekInfo.clientFallback();
    } on FormatException {
      // If date parsing fails, use client-side fallback
      return ServerWeekInfo.clientFallback();
    } on DioException {
      // If server endpoint fails, use client-side fallback
      return ServerWeekInfo.clientFallback();
    }
  }

  /// Fetch combined feed with services and bulletins (unified endpoint)
  Future<BulletinFeedResponse> fetchCombinedFeed(BulletinFilter filter) async {
    try {
      final queryParams = filter.toQueryParams();
      queryParams['include_services'] = 'true';

      final response = await _client.get<dynamic>(
        '/v1/bulletins/',
        queryParameters: queryParams,
      );

      final data = response.data;

      if (data is Map<String, dynamic>) {
        return BulletinFeedResponse.fromJson(data);
      }

      // If unexpected format, return empty data
      return const BulletinFeedResponse(services: [], bulletins: []);
    } on DioException catch (error) {
      throw Exception('Failed to load bulletin feed: ${error.message}');
    }
  }

  /// Fetch paginated bulletins using the provided filter (bulletins only, no services)
  Future<List<Bulletin>> fetchBulletins(BulletinFilter filter) async {
    try {
      final response = await _client.get<dynamic>(
        '/v1/bulletins/',
        queryParameters: filter.toQueryParams(),
      );

      final data = response.data;

      if (data is List) {
        return data
            .whereType<Map<String, dynamic>>()
            .map(Bulletin.fromJson)
            .toList();
      }

      return _coerceFromEnvelope(data);
    } on DioException catch (error) {
      throw Exception('Failed to load bulletins: ${error.message}');
    }
  }

  /// Fetch a single bulletin by identifier.
  Future<Bulletin?> fetchBulletinById(String id) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/v1/bulletins/$id',
      );
      if (response.data == null) return null;
      return Bulletin.fromJson(response.data!);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      throw Exception('Failed to load bulletin $id: ${error.message}');
    }
  }

  /// Convenience helper to run a search without mutating the original filter.
  Future<List<Bulletin>> search(String query, {BulletinFilter? filter}) {
    return fetchBulletins(filter ?? const BulletinFilter());
  }

  List<Bulletin> _coerceFromEnvelope(dynamic data) {
    if (data is Map<String, dynamic>) {
      final candidates = data['items'] ?? data['results'] ?? data['data'];
      if (candidates is List) {
        return candidates
            .whereType<Map<String, dynamic>>()
            .map(Bulletin.fromJson)
            .toList();
      }
    }
    return <Bulletin>[];
  }
}

