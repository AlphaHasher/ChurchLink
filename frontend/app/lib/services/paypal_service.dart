import 'dart:developer';
// import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../helpers/api_client.dart';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';

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

  static Future<Map<String, dynamic>?> createOrder(
    Map<String, dynamic> donation,
  ) async {
    validateDonation(donation);

    final backendUrl =
        dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final endpoint = '/v1/paypal/orders';
    log(
      '[PaypalService] Sending donation order creation to: $backendUrl$endpoint',
    );
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await api.post(endpoint, data: {'donation': donation});
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
    final endpoint = '/v1/paypal/orders/$orderId/capture';
    log(
      '[PaypalService] captureOrder called for $orderId with payerId $payerId',
    );
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
    validateDonation(donation);

    final backendUrl =
        dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final endpoint = '/v1/paypal/subscription';
    log(
      '[PaypalService] Sending subscription creation to: $backendUrl$endpoint',
    );
    log('[PaypalService] Payload: ${jsonEncode({'donation': donation})}');
    try {
      final response = await api.post(endpoint, data: {'donation': donation});
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
      log(
        '[PaypalService] Fund purposes response status: \\${response.statusCode}',
      );
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

  // Event-specific PayPal methods

  /// Create a PayPal payment order for an event using the simplified endpoint
  static Future<Map<String, dynamic>?> createEventPaymentOrder({
    required String eventId,
    required String eventName,
    required double eventFee,
    required double donationAmount,
    String? message,
    String? returnUrl,
    String? cancelUrl,
  }) async {
    final endpoint = '/v1/events/$eventId/payment/create-bulk-order';
    log('[PaypalService] Creating event payment order for event: $eventId');
    log('[PaypalService] Event fee: $eventFee, Donation amount: $donationAmount');

    // Use mobile deep links if no custom URLs provided
    final successUrl = returnUrl ?? 'churchlink://paypal-success';
    final cancelUrlFinal = cancelUrl ?? 'churchlink://paypal-cancel';

    // Use simplified registration format with proper amount separation
    final registrations = [
      {
        'person_id': null, // Self registration
        'name': 'Event Registration',
        'payment_amount_per_person': eventFee,
        'donation_amount': donationAmount,
      },
    ];

    final payload = {
      'registrations': registrations,
      'payment_option': 'paypal',
      'return_url': successUrl,
      'cancel_url': cancelUrlFinal,
    };

    log('[PaypalService] Event payment payload: ${jsonEncode(payload)}');
    log('[PaypalService] Using endpoint: $endpoint');
    log('[PaypalService] Return URL: $successUrl');
    log('[PaypalService] Cancel URL: $cancelUrlFinal');

    try {
      final response = await api.post(endpoint, data: payload);

      log(
        '[PaypalService] Event payment response status: ${response.statusCode}',
      );
      log('[PaypalService] Event payment response body: ${response.data}');

      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return {
            'success': true,
            'approval_url': decoded['approval_url'],
            'payment_id': decoded['payment_id'],
          };
        }
      }

      log('Event payment order creation failed: ${response.data}');
      return {
        'success': false,
        'error': response.data['detail'] ?? 'Failed to create payment order',
      };
    } catch (e) {
      log('[PaypalService] Event payment order creation error: $e');
      return {'success': false, 'error': 'Network error: ${e.toString()}'};
    }
  }

  /// Get payment status for an event
  static Future<Map<String, dynamic>?> getEventPaymentStatus(
    String eventId,
  ) async {
    final endpoint = '/v1/events/$eventId/payment/status';
    log('[PaypalService] Getting payment status for event: $eventId');

    try {
      final response = await api.get(endpoint);

      log('[PaypalService] Payment status response: ${response.statusCode}');
      log('[PaypalService] Payment status data: ${response.data}');

      if (response.statusCode == 200) {
        return {'success': true, 'data': response.data};
      }

      return {
        'success': false,
        'error': response.data['detail'] ?? 'Failed to get payment status',
      };
    } catch (e) {
      log('[PaypalService] Payment status error: $e');
      return {'success': false, 'error': 'Network error: ${e.toString()}'};
    }
  }

  /// Handle payment completion for events using bulk system for consistency
  static Future<Map<String, dynamic>?> completeEventPayment({
    required String eventId,
    required String paymentId,
    required String payerId,
    String? userEmail,
  }) async {
    final endpoint = '/v1/events/$eventId/payment/complete-bulk-registration';
    log(
      '[PaypalService] Completing event payment: $paymentId for event: $eventId with user: $userEmail',
    );

    // Use bulk registration system with single registration for consistency
    final registrations = [
      {
        'name': 'Event Registration',
        'family_member_id': null, // Self registration
        'donation_amount': 0.0,
      },
    ];

    final payload = {
      'registrations': registrations,
      'payment_id': paymentId,
      'payer_id': payerId,
      'total_amount': 0.0, // Will be calculated by backend
    };

    // Add user email if provided
    if (userEmail != null && userEmail.isNotEmpty) {
      payload['payer_email'] = userEmail;
    }

    try {
      final response = await api.post(endpoint, data: payload);

      log(
        '[PaypalService] Payment completion response: ${response.statusCode}',
      );
      log('[PaypalService] Payment completion data: ${response.data}');

      if (response.statusCode == 200) {
        return {'success': true, 'data': response.data};
      }

      return {
        'success': false,
        'error': response.data['detail'] ?? 'Failed to complete payment',
      };
    } catch (e) {
      log('[PaypalService] Payment completion error: $e');
      return {'success': false, 'error': 'Network error: ${e.toString()}'};
    }
  }

  // Bulk registration methods

  /// Create a PayPal payment order for multiple event registrations
  static Future<Map<String, dynamic>?> createBulkEventPaymentOrder({
    required String eventId,
    required List<Map<String, dynamic>> registrations,
    String? message,
    String? returnUrl,
    String? cancelUrl,
  }) async {
    // Validate that we have registrations with valid amounts
    double totalAmount = 0.0;
    for (final registration in registrations) {
      final regAmount = registration['donation_amount'] as double? ?? 0.0;
      final eventAmount = registration['amount'] as double? ?? 0.0;
      totalAmount += regAmount + eventAmount;
    }
    if (totalAmount > 0) {
      validateAmount(totalAmount);
    }

    final endpoint = '/v1/events/$eventId/payment/create-bulk-order';
    log(
      '[PaypalService] Creating bulk event payment order for event: $eventId',
    );
    log('[PaypalService] Number of registrations: ${registrations.length}');

    // Use mobile deep links if no custom URLs provided
    final successUrl = returnUrl ?? 'churchlink://paypal-success';
    final cancelUrlFinal = cancelUrl ?? 'churchlink://paypal-cancel';

    final payload = {
      'registrations': registrations,
      'message': message ?? 'Bulk registration payment',
      'return_url': successUrl,
      'cancel_url': cancelUrlFinal,
    };

    log('[PaypalService] Bulk payment payload: ${jsonEncode(payload)}');

    try {
      final response = await api.post(endpoint, data: payload);

      log(
        '[PaypalService] Bulk payment response status: ${response.statusCode}',
      );
      log('[PaypalService] Bulk payment response body: ${response.data}');

      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return {
            'success': true,
            'approval_url': decoded['approval_url'],
            'payment_id': decoded['payment_id'],
          };
        }
      }

      log('Bulk event payment order creation failed: ${response.data}');
      return {
        'success': false,
        'error':
            response.data['detail'] ?? 'Failed to create bulk payment order',
      };
    } catch (e) {
      log('[PaypalService] Bulk event payment order creation error: $e');
      return {'success': false, 'error': 'Network error: ${e.toString()}'};
    }
  }

  /// Complete bulk event registration after successful payment
  static Future<Map<String, dynamic>?> completeBulkEventRegistration({
    required String eventId,
    required List<Map<String, dynamic>> registrations,
    required String paymentId,
    required String payerId,
  }) async {
    final endpoint = '/v1/events/$eventId/payment/complete-bulk-registration';
    log('[PaypalService] Completing bulk registration for event: $eventId');

    // Get current user's UID
    final userUid = FirebaseAuth.instance.currentUser?.uid;
    if (userUid == null) {
      log('[PaypalService] Error: No authenticated user found');
      return {'success': false, 'error': 'User not authenticated'};
    }

    final payload = {
      'registrations': registrations,
      'payment_id': paymentId,
      'payer_id': payerId,
      'user_uid': userUid, // Include user UID for backend
    };

    log('[PaypalService] Payload includes user_uid: $userUid');

    try {
      final response = await api.post(endpoint, data: payload);

      log(
        '[PaypalService] Bulk registration completion response: ${response.statusCode}',
      );
      log(
        '[PaypalService] Bulk registration completion data: ${response.data}',
      );

      if (response.statusCode == 200) {
        return {'success': true, 'data': response.data};
      }

      return {
        'success': false,
        'error':
            response.data['detail'] ?? 'Failed to complete bulk registration',
      };
    } catch (e) {
      log('[PaypalService] Bulk registration completion error: $e');
      return {'success': false, 'error': 'Network error: ${e.toString()}'};
    }
  }
}
