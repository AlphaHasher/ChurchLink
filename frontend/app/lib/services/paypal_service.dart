import 'dart:developer';
import 'package:app/helpers/api_client.dart';

class PaypalService {
  /// Validate that the amount is positive for PayPal payments
  static void validateAmount(double amount) {
    if (amount <= 0) {
      log('[PaypalService] Cannot create PayPal order with amount: $amount');
      throw Exception(
        'PayPal orders require a positive amount. Amount provided: $amount',
      );
    }
  }

  /// Validate donation data including amount
  static void validateDonation(Map<String, dynamic> donation) {
    final amount = donation['amount'] as double?;
    if (amount != null) {
      validateAmount(amount);
    }
  }

  /// Get church name from church settings
  static Future<String> getChurchName() async {
    const endpoint = '/v1/website/church/settings';
    log('[PaypalService] Fetching church settings from: $endpoint');
    try {
      final response = await api.get(endpoint);
      log(
        '[PaypalService] Church settings response status: \\${response.statusCode}',
      );
      log('[PaypalService] Church settings response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          final settings = decoded['settings'] as Map<String, dynamic>?;
          final churchName = settings?['CHURCH_NAME'] as String?;
          if (churchName != null && churchName.isNotEmpty) {
            return churchName;
          }
        }
      }
      log('Failed to fetch church name from settings: \\${response.data}');
      // Return default church name if API fails
      return 'Your Church Name';
    } catch (e) {
      log('[PaypalService] Church name fetch error: $e');
      // Return default church name if API fails
      return 'Your Church Name';
    }
  }

  /// Get church address information from church settings
  static Future<Map<String, String>> getChurchAddress() async {
    const endpoint = '/v1/website/church/settings';
    log('[PaypalService] Fetching church settings for address from: $endpoint');
    try {
      final response = await api.get(endpoint);
      log(
        '[PaypalService] Church settings response status: \\${response.statusCode}',
      );
      log('[PaypalService] Church settings response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          final settings = decoded['settings'] as Map<String, dynamic>?;
          if (settings != null) {
            return {
              'address':
                  settings['CHURCH_ADDRESS'] as String? ?? '123 Main Street',
              'city': settings['CHURCH_CITY'] as String? ?? 'Your City',
              'state': settings['CHURCH_STATE'] as String? ?? 'ST',
              'postal_code':
                  settings['CHURCH_POSTAL_CODE'] as String? ?? '12345',
            };
          }
        }
      }
      log('Failed to fetch church address from settings: \\${response.data}');
      // Return default address if API fails
      return {
        'address': '123 Main Street',
        'city': 'Your City',
        'state': 'ST',
        'postal_code': '12345',
      };
    } catch (e) {
      log('[PaypalService] Church address fetch error: $e');
      // Return default address if API fails
      return {
        'address': '123 Main Street',
        'city': 'Your City',
        'state': 'ST',
        'postal_code': '12345',
      };
    }
  }
}
