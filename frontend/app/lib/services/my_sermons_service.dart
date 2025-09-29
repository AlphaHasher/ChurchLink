import 'package:dio/dio.dart';

import '../helpers/api_client.dart';

class MySermonsService {
  MySermonsService({Dio? client}) : _client = client ?? api;

  final Dio _client;

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
