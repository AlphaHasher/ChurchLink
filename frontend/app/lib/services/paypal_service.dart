import 'dart:developer';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';


class PaypalService {
  static Future<Map<String, dynamic>?> createOrder(Map<String, dynamic> donation) async {
    final backendUrl = dotenv.env['BACKEND_URL'];
    final url = Uri.parse('$backendUrl/paypal/orders');
    log('[PaypalService] Sending donation order creation to: $url');
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'donation': donation}),
      );
      log('[PaypalService] Response status: ${response.statusCode}');
      log('[PaypalService] Response body: ${response.body}');
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          // approvalUrl is provided directly by backend
          return decoded;
        }
        return null;
      }
      log('Donation order creation failed: ${response.body}');
      return null;
    } catch (e) {
      log('[PaypalService] Donation order creation error: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> captureOrder(String orderId, String payerId) async {
    final backendUrl = dotenv.env['BACKEND_URL'];
    final url = Uri.parse('$backendUrl/paypal/orders/$orderId/capture?payer_id=$payerId');
    log('[PaypalService] captureOrder called for $orderId with payerId $payerId');
    try {
      final response = await http.post(url);
      log('[PaypalService] Capture response status: ${response.statusCode}');
      log('[PaypalService] Capture response body: ${response.body}');
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded is Map<String, dynamic> ? decoded : null;
      }
      return null;
    } catch (e) {
      log('[PaypalService] Capture error: $e');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> createSubscription(Map<String, dynamic> donation) async {
    final backendUrl = dotenv.env['BACKEND_URL'];
    final url = Uri.parse('$backendUrl/paypal/subscription');
    log('[PaypalService] Sending subscription creation to: $url');
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'donation': donation}),
      );
      log('[PaypalService] Response status: ${response.statusCode}');
      log('[PaypalService] Response body: ${response.body}');
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
        return null;
      }
      log('Subscription creation failed: ${response.body}');
      return null;
    } catch (e) {
      log('[PaypalService] Subscription creation error: $e');
      return null;
    }
  }

  static Future<List<String>> getFundPurposes() async {
    final backendUrl = dotenv.env['BACKEND_URL'];
    final url = Uri.parse('$backendUrl/paypal/fund-purposes');
    log('[PaypalService] Fetching fund purposes from: $url');
    try {
      final response = await http.get(url);
      log('[PaypalService] Fund purposes response status: ${response.statusCode}');
      log('[PaypalService] Fund purposes response body: ${response.body}');
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded.cast<String>();
        }
      }
      log('Failed to fetch fund purposes: ${response.body}');
      // Return default purposes if API fails
      return ['General', 'Building', 'Missions', 'Youth', 'Other'];
    } catch (e) {
      log('[PaypalService] Fund purposes fetch error: $e');
      // Return default purposes if API fails
      return ['General', 'Building', 'Missions', 'Youth', 'Other'];
    }
  }
}
