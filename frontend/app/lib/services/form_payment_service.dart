import 'dart:developer';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/helpers/api_client.dart';
import 'dart:convert';

class FormPaymentService {
  /// Create a PayPal payment order for form submission
  static Future<Map<String, dynamic>?> createFormPaymentOrder({
    required String formSlug,
    required Map<String, dynamic> paymentData,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      final userId = user?.uid ?? 'anonymous';
      
      log('[FormPaymentService] Creating payment order for form: $formSlug');
      log('[FormPaymentService] Payment data: ${jsonEncode(paymentData)}');

      final endpoint = '/v1/forms/slug/$formSlug/payment/create-order';
      
      final requestData = {
        'user_uid': userId,
        'payment_amount': paymentData['amount'],
        'form_response': paymentData['form_response'] ?? {},
        'metadata': paymentData['metadata'] ?? {},
      };

      final response = await api.post(endpoint, data: requestData);
      
      log('[FormPaymentService] Response status: ${response.statusCode}');
      log('[FormPaymentService] Response body: ${response.data}');

      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic> && decoded['success'] == true) {
          return decoded;
        }
      }
      
      log('[FormPaymentService] Form payment order creation failed: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] Form payment order creation error: $e');
      return null;
    }
  }

  /// Complete form submission after PayPal payment
  static Future<Map<String, dynamic>?> completeFormSubmission({
    required String formSlug,
    required String paymentId,
    required String payerId,
    required Map<String, dynamic> formResponse,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      final userId = user?.uid ?? 'anonymous';
      
      log('[FormPaymentService] Completing form submission for: $formSlug');
      log('[FormPaymentService] Payment ID: $paymentId, Payer ID: $payerId');

      final endpoint = '/v1/forms/slug/$formSlug/payment/complete-submission';
      
      final requestData = {
        'user_id': userId,
        'payment_id': paymentId,
        'payer_id': payerId,
        'form_response': formResponse,
      };

      final response = await api.post(endpoint, data: requestData);
      
      log('[FormPaymentService] Completion response status: ${response.statusCode}');
      log('[FormPaymentService] Completion response body: ${response.data}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      }
      
      log('[FormPaymentService] Form submission completion failed: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] Form submission completion error: $e');
      return null;
    }
  }

  /// Complete PayPal payment and finalize form submission
  static Future<Map<String, dynamic>?> completePayPalPayment({
    required String formSlug,
    required String orderId,
    required String payerId,
    required Map<String, dynamic> formResponse,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      final userId = user?.uid ?? 'anonymous';
      
      // Create a fallback name if displayName is null or empty
      String payerName = '';
      if (user?.displayName != null && user!.displayName!.isNotEmpty) {
        payerName = user.displayName!;
      } else if (user?.email != null) {
        // Use the part before @ as a fallback name
        payerName = user!.email!.split('@')[0];
      }
      
      log('[FormPaymentService] Completing PayPal payment for: $formSlug');
      log('[FormPaymentService] Order ID: $orderId, Payer ID: $payerId');

      final endpoint = '/v1/forms/slug/$formSlug/payment/complete-submission';
      
      final requestData = {
        'user_uid': userId,     // Match React frontend field name
        'payment_id': orderId,  // PayPal order ID 
        'payer_id': payerId,    // PayPal payer ID (lowercase like React)
        'form_response': formResponse,
        'payer_email': user?.email,
        'payer_name': payerName,
      };

      log('[FormPaymentService] Request payload: $requestData');
      log('[FormPaymentService] User details: email=${user?.email}, displayName=${user?.displayName}, uid=${user?.uid}');
      log('[FormPaymentService] Generated payer_name: $payerName');

      final response = await api.post(endpoint, data: requestData);
      
      log('[FormPaymentService] PayPal completion response status: ${response.statusCode}');
      log('[FormPaymentService] PayPal completion response body: ${response.data}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      }
      
      log('[FormPaymentService] PayPal payment completion failed: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] PayPal payment completion error: $e');
      return null;
    }
  }

  /// Get payment configuration for a form
  static Future<Map<String, dynamic>?> getFormPaymentConfig({
    required String formSlug,
  }) async {
    try {
      log('[FormPaymentService] Getting payment config for form: $formSlug');

      final endpoint = '/v1/forms/slug/$formSlug/payment-config';
      
      final response = await api.get(endpoint);
      
      log('[FormPaymentService] Payment config response status: ${response.statusCode}');
      log('[FormPaymentService] Payment config response body: ${response.data}');

      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      }
      
      log('[FormPaymentService] Failed to get payment config: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] Payment config error: $e');
      return null;
    }
  }

  /// Get form payment summary
  static Future<Map<String, dynamic>?> getFormPaymentSummary({
    required String formId,
  }) async {
    try {
      log('[FormPaymentService] Getting payment summary for form: $formId');

      final endpoint = '/v1/forms/$formId/payment-summary';
      
      final response = await api.get(endpoint);
      
      log('[FormPaymentService] Payment summary response status: ${response.statusCode}');
      log('[FormPaymentService] Payment summary response body: ${response.data}');

      if (response.statusCode == 200) {
        final decoded = response.data;
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
      }
      
      log('[FormPaymentService] Failed to get payment summary: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] Payment summary error: $e');
      return null;
    }
  }

  /// Calculate total form amount based on form fields and values
  static double calculateFormTotal(
    Map<String, dynamic> form,
    Map<String, dynamic> values,
  ) {
    double total = 0.0;
    
    final fields = form['data'];
    if (fields is! List) return total;

    for (final field in fields) {
      if (field is! Map<String, dynamic>) continue;
      
      final type = field['type']?.toString() ?? 'text';
      final name = field['name']?.toString() ?? '';
      final value = values[name];

      switch (type) {
        case 'price':
          if (value is num) {
            total += value.toDouble();
          }
          break;
          
        case 'checkbox':
        case 'switch':
          if (value == true && field['price'] is num) {
            total += (field['price'] as num).toDouble();
          }
          break;
          
        case 'radio':
        case 'select':
          final options = field['options'] ?? field['choices'] ?? [];
          if (options is List && value != null) {
            for (final option in options) {
              if (option is Map<String, dynamic> && 
                  option['value'] == value && 
                  option['price'] is num) {
                total += (option['price'] as num).toDouble();
              }
            }
          }
          break;
          
        case 'date':
          // Handle date-based pricing if needed
          final pricing = field['pricing'];
          if (pricing is Map<String, dynamic> && value is String) {
            // Parse date and calculate pricing based on weekday
            try {
              final date = DateTime.parse(value);
              final weekday = _getWeekdayName(date.weekday);
              if (pricing[weekday] is num) {
                total += (pricing[weekday] as num).toDouble();
              }
            } catch (e) {
              log('[FormPaymentService] Date parsing error: $e');
            }
          }
          break;
      }
    }
    
    return total;
  }

  /// Helper to get weekday name from number
  static String _getWeekdayName(int weekday) {
    switch (weekday) {
      case 1: return 'monday';
      case 2: return 'tuesday';
      case 3: return 'wednesday';
      case 4: return 'thursday';
      case 5: return 'friday';
      case 6: return 'saturday';
      case 7: return 'sunday';
      default: return 'monday';
    }
  }

  /// Check if form requires payment
  static bool formRequiresPayment(Map<String, dynamic> form) {
    final fields = form['data'];
    if (fields is! List) return false;

    for (final field in fields) {
      if (field is! Map<String, dynamic>) continue;
      
      final type = field['type']?.toString() ?? 'text';
      
      // Check for price fields
      if (type == 'price') return true;
      
      // Check for fields with pricing
      if ((type == 'checkbox' || type == 'switch') && field['price'] != null) {
        return true;
      }
      
      // Check for options with pricing
      if (type == 'radio' || type == 'select') {
        final options = field['options'] ?? field['choices'] ?? [];
        if (options is List) {
          for (final option in options) {
            if (option is Map<String, dynamic> && option['price'] != null) {
              return true;
            }
          }
        }
      }
      
      // Check for date fields with pricing
      if (type == 'date' && field['pricing'] != null) {
        return true;
      }
    }
    
    return false;
  }

  /// Complete door payment and submit form
  static Future<Map<String, dynamic>?> completeDoorPayment({
    required String formSlug,
    required Map<String, dynamic> formResponse,
    required double paymentAmount,
  }) async {
    try {
      log('[FormPaymentService] Completing door payment for: $formSlug');
      log('[FormPaymentService] Payment amount: $paymentAmount');

      // Submit to regular form response endpoint with payment metadata
      final endpoint = '/v1/forms/slug/$formSlug/responses';
      
      final requestData = {
        ...formResponse,
        'payment_method': 'door',
        'payment_amount': paymentAmount,
        'payment_status': 'pending',
      };

      final response = await api.post(endpoint, data: requestData);
      
      log('[FormPaymentService] Door payment response status: ${response.statusCode}');
      log('[FormPaymentService] Door payment response body: ${response.data}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'message': 'Form submitted successfully. Payment will be collected at the door.',
          'payment_method': 'door',
          'amount': paymentAmount,
          'status': 'pending'
        };
      }
      
      log('[FormPaymentService] Door payment completion failed: ${response.data}');
      return null;
    } catch (e) {
      log('[FormPaymentService] Door payment completion error: $e');
      return null;
    }
  }

  /// Get available payment methods for a form
  static List<String> getAvailablePaymentMethods(Map<String, dynamic> form) {
    final fields = form['data'];
    if (fields is! List) return [];

    bool allowPayPal = false;
    bool allowDoor = false;
    bool foundPriceFields = false;

    for (final field in fields) {
      if (field is! Map<String, dynamic>) continue;
      
      final type = field['type']?.toString() ?? 'text';
      
      if (type == 'price') {
        foundPriceFields = true;
        final paymentMethods = field['paymentMethods'];
        
        if (paymentMethods is Map<String, dynamic>) {
          // Check for PayPal (treat undefined as enabled for backward compatibility)
          if (paymentMethods['allowPayPal'] != false) {
            allowPayPal = true;
          }
          
          // Check for door/in-person payment
          if (paymentMethods['allowInPerson'] == true || paymentMethods['allowDoor'] == true) {
            allowDoor = true;
          }
        } else {
          // If no payment methods specified, default to both for backward compatibility
          allowPayPal = true;
          allowDoor = true;
        }
      }
    }

    // If we found price fields but no specific methods configured, default to both
    if (foundPriceFields && !allowPayPal && !allowDoor) {
      allowPayPal = true;
      allowDoor = true;
    }

    final methods = <String>[];
    if (allowPayPal) methods.add('paypal');
    if (allowDoor) methods.add('door');
    
    return methods;
  }
}