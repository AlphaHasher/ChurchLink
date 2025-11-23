import 'package:app/helpers/api_client.dart';
import 'package:app/models/ministry.dart';

/// Service for fetching ministries from the backend API
class MinistryService {
  /// Fetch all ministries from the backend
  /// Returns an empty list if there's an error
  static Future<List<Ministry>> getAllMinistries() async {
    try {
      final response = await api.get('/v1/ministries');

      if (response.data is! List) {
        print('Error: ministries response is not a list');
        return [];
      }

      final List<dynamic> data = response.data as List<dynamic>;
      return data
          .whereType<Map<String, dynamic>>()
          .map((json) => Ministry.fromJson(json))
          .toList();
    } catch (e, stackTrace) {
      print('Error fetching ministries: $e');
      print(stackTrace);
      return [];
    }
  }

  /// Get a single ministry by ID
  static Future<Ministry?> getMinistryById(String id) async {
    try {
      final response = await api.get('/v1/ministries/$id');

      if (response.data is! Map) {
        print('Error: ministry response is not a map');
        return null;
      }

      return Ministry.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      print('Error fetching ministry $id: $e');
      return null;
    }
  }
}
