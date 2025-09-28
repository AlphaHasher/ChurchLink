import 'package:dio/dio.dart';

import '../helpers/api_client.dart';
import '../models/sermon_favorite.dart';

class MySermonsService {
  MySermonsService({Dio? client}) : _client = client ?? api;

  final Dio _client;

  Future<List<SermonFavorite>> fetchFavorites({bool expand = true}) async {
    try {
      final response = await _client.get<dynamic>(
        '/v1/sermons/favorites',
        queryParameters: {'expand': expand ? 'true' : 'false'},
      );

      final data = response.data;
      if (data is Map<String, dynamic>) {
        return SermonFavoritesResponse.fromJson(data).favorites;
      }

      if (data is List) {
        return data
            .whereType<Map<String, dynamic>>()
            .map(SermonFavorite.fromJson)
            .toList();
      }

      return <SermonFavorite>[];
    } on DioException catch (error) {
      throw Exception('Failed to load sermon favorites: ${error.message}');
    }
  }

  Future<bool> removeFavorite(String sermonId) async {
    try {
      final response = await _client.delete('/v1/sermons/$sermonId/favorite');
      return response.statusCode != null &&
          response.statusCode! >= 200 &&
          response.statusCode! < 300;
    } on DioException catch (error) {
      throw Exception('Failed to remove favorite $sermonId: ${error.message}');
    }
  }
}
