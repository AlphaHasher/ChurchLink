import 'package:dio/dio.dart';
import 'package:app/helpers/api_client.dart'; // adjust to your actual path
import 'package:app/models/legal_model.dart';

class LegalApi {
  /// Fetch a public legal page. Locale is optional; server will pick best match.
  static Future<LegalPageDto> fetchPage(String slug, {String? locale}) async {
    final Response res = await api.get(
      '/v1/legal/$slug',
      queryParameters: locale != null ? {'locale': locale} : null,
    );
    return LegalPageDto.fromJson(res.data as Map<String, dynamic>);
  }
}