import 'dart:developer';
// import 'package:http/http.dart' as http;
import '../helpers/api_client.dart';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class PaypalService {
  static Future<Map<String, dynamic>?> createOrder(
    Map<String, dynamic> donation,
  ) async {
    final backendUrl =
        dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final endpoint = '/v1/paypal/orders';
    log('[PaypalService] Sending donation order creation to: $backendUrl$endpoint');
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await api.post(
        endpoint,
        data: {'donation': donation},
      );
      log('[PaypalService] Response status: \\${response.statusCode}');
      log('[PaypalService] Response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          // approvalUrl is provided directly by backend
          return decoded;
        }
        return null;
      }
      log('Donation order creation failed: \\${response.data}');
      return null;
    } catch (e) {
      log('[PaypalService] Donation order creation error: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> captureOrder(
    String orderId,
    String payerId,
  ) async {
    final backendUrl =
        dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final endpoint = '/v1/paypal/orders/$orderId/capture';
    log('[PaypalService] captureOrder called for $orderId with payerId $payerId');
    try {
      final response = await api.post(
        endpoint,
        queryParameters: {'payer_id': payerId},
      );
      log('[PaypalService] Capture response status: \\${response.statusCode}');
      log('[PaypalService] Capture response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        return decoded is Map<String, dynamic> ? decoded : null;
      }
      return null;
    } catch (e) {
      log('[PaypalService] Capture error: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> createSubscription(
    Map<String, dynamic> donation,
  ) async {
    final backendUrl =
        dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final endpoint = '/v1/paypal/subscription';
    log('[PaypalService] Sending subscription creation to: $backendUrl$endpoint');
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await api.post(
        endpoint,
        data: {'donation': donation},
      );
      log('[PaypalService] Response status: \\${response.statusCode}');
      log('[PaypalService] Response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
        return null;
      }
      log('Subscription creation failed: \\${response.data}');
      return null;
    } catch (e) {
      log('[PaypalService] Subscription creation error: $e');
      return null;
    }
  }

  static Future<List<String>> getFundPurposes() async {
    const endpoint = '/v1/paypal/fund-purposes';
    log('[PaypalService] Fetching fund purposes from: $endpoint');
    try {
      final response = await api.get(endpoint);
      log('[PaypalService] Fund purposes response status: \\${response.statusCode}');
      log('[PaypalService] Fund purposes response body: \\${response.data}');
      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is List) {
          return decoded.cast<String>();
        }
      }
      log('Failed to fetch fund purposes: \\${response.data}');
      // Return default purposes if API fails
      return ['General', 'Building', 'Missions', 'Youth', 'Other'];
    } catch (e) {
      log('[PaypalService] Fund purposes fetch error: $e');
      // Return default purposes if API fails
      return ['General', 'Building', 'Missions', 'Youth', 'Other'];
    }
  }
}
