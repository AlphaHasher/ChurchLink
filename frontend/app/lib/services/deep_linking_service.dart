import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:developer';
import 'package:app/pages/event_showcase.dart';
import 'package:app/models/event.dart';
import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/backend_helper.dart';
import 'package:app/services/paypal_service.dart';
import 'package:app/main.dart';

class DeepLinkingService {
  // Reference to the navigator key
  static GlobalKey<NavigatorState>? _navigatorKey;
  static AppLinks? _appLinks;
  static StreamSubscription<Uri>? _linkSubscription;
  
  /// Initialize the service with the navigator key from main.dart
  static void initialize(GlobalKey<NavigatorState> navKey) {
    _navigatorKey = navKey;
    _initializeAppLinks();
  }

  /// Initialize app links for PayPal deep link handling
  static void _initializeAppLinks() {
    _appLinks = AppLinks();
    _linkSubscription = _appLinks!.uriLinkStream.listen((uri) async {
      log('[DeepLinkingService] Received deep link: $uri');
      await _handleAppLink(uri);
    });
  }

  /// Handle app link deep links (PayPal, etc.)
  static Future<void> _handleAppLink(Uri uri) async {
    try {
      if (uri.scheme == 'churchlink' && uri.host == 'paypal-success') {
        await _handlePayPalSuccess(uri);
      } else if (uri.scheme == 'churchlink' && uri.host == 'paypal-cancel') {
        await _handlePayPalCancel(uri);
      }
    } catch (e) {
      log('[DeepLinkingService] Error handling app link: $e');
    }
  }

  /// Handle PayPal success deep link
  static Future<void> _handlePayPalSuccess(Uri uri) async {
    log('[DeepLinkingService] PayPal success deep link detected');
    
    // Extract PayPal parameters from the URI
    final paymentId = uri.queryParameters['paymentId'] ?? uri.queryParameters['payment_id'];
    final payerId = uri.queryParameters['PayerID'] ?? uri.queryParameters['payer_id'];
    final token = uri.queryParameters['token'];
    
    log('[DeepLinkingService] Extracted parameters - paymentId: $paymentId, payerId: $payerId, token: $token');
    
    // Check if this is an event payment by looking for eventId in path or query parameters
    String? eventId = uri.queryParameters['eventId'] ?? uri.queryParameters['event_id'];
    
    // If not in query parameters, check if it's in the path (new format: churchlink://paypal-success/eventId)
    if (eventId == null && uri.pathSegments.isNotEmpty) {
      eventId = uri.pathSegments.first;
    }
    
    log('[DeepLinkingService] Extracted eventId: $eventId');
    
    if (eventId != null && paymentId != null && payerId != null) {
      await _completeEventPayment(eventId, paymentId, payerId);
    } else {
      // Regular donation payment - navigate to success page
      final nav = (_navigatorKey ?? navigatorKey).currentState;
      if (nav != null) {
        nav.pushNamed(
          '/paypal-success',
          arguments: {'token': token},
        );
      }
    }
  }

  /// Handle PayPal cancel deep link
  static Future<void> _handlePayPalCancel(Uri uri) async {
    log('[DeepLinkingService] PayPal cancel deep link detected');
    
    // Check if this is an event payment cancellation by looking for eventId in path or query parameters
    String? eventId = uri.queryParameters['eventId'] ?? uri.queryParameters['event_id'];
    
    // If not in query parameters, check if it's in the path (new format: churchlink://paypal-cancel/eventId)
    if (eventId == null && uri.pathSegments.isNotEmpty) {
      eventId = uri.pathSegments.first;
    }
    
    final nav = (_navigatorKey ?? navigatorKey).currentState;
    if (nav != null) {
      if (eventId != null) {
        // Event payment was cancelled
        _showEventPaymentCancelDialog(nav.context);
      } else {
        // Regular donation cancellation
        nav.pushNamed('/cancel');
      }
    }
  }

  /// Complete event payment after PayPal success
  static Future<void> _completeEventPayment(String eventId, String paymentId, String payerId) async {
    try {
      log('[DeepLinkingService] Event payment detected - eventId: $eventId, paymentId: $paymentId, payerId: $payerId');
      
      // Check if this is a bulk registration by looking for pending bulk registration data
      final pendingBulkData = await _getPendingBulkRegistration();
      log('[DeepLinkingService] Pending bulk data: $pendingBulkData');
      log('[DeepLinkingService] Bulk data exists: ${pendingBulkData != null}');
      if (pendingBulkData != null) {
        log('[DeepLinkingService] Bulk data eventId: ${pendingBulkData['eventId']}, current eventId: $eventId');
        log('[DeepLinkingService] EventId match: ${pendingBulkData['eventId'] == eventId}');
      }
      
  if (pendingBulkData != null && pendingBulkData['eventId'] == eventId) {
        // This is a bulk registration completion
        log('[DeepLinkingService] Processing bulk registration completion');
        final registrations = pendingBulkData['registrations'] as List<dynamic>;
        final result = await PaypalService.completeBulkEventRegistration(
          eventId: eventId,
          registrations: registrations.cast<Map<String, dynamic>>(),
          paymentId: paymentId,
          payerId: payerId,
        );
        
        log('[DeepLinkingService] Bulk registration API result: $result');
        
        // Clear pending data
        await _clearPendingBulkRegistration();
        
        if (result != null && result['success'] == true) {
          log('[DeepLinkingService] Bulk registration completed successfully');
          // Close any open dialogs and clear navigation stack
          final nav = (_navigatorKey ?? navigatorKey).currentState;
          if (nav == null) return;

          nav.popUntil((route) => route.isFirst);

          // Navigate to events list, replacing the current route
          nav.pushNamedAndRemoveUntil(
            '/events',
            (route) => false, // Remove all previous routes
          );

          // Show success message after navigation
          final numberOfPeople = registrations.length;
          Future.delayed(Duration(milliseconds: 800), () {
            final nav2 = (_navigatorKey ?? navigatorKey).currentState;
            if (nav2 == null || !nav2.mounted) return;
            ScaffoldMessenger.of(nav2.context).showSnackBar(
              SnackBar(
                content: Text(
                  '✅ Successfully registered $numberOfPeople ${numberOfPeople == 1 ? 'person' : 'people'} for the event!',
                ),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 4),
              ),
            );
          });
        } else {
          log('[DeepLinkingService] Bulk registration failed: ${result?['error']}');
          final nav = (_navigatorKey ?? navigatorKey).currentState;
          if (nav != null && nav.mounted) {
            _showEventPaymentErrorDialog(nav.context, result?['error'] ?? 'Bulk registration failed');
          }
        }
      } else {
        // Single event payment
        log('[DeepLinkingService] Processing single event payment completion');
        
        // Get current user email for registration
        final userEmail = FirebaseAuth.instance.currentUser?.email;
        log('[DeepLinkingService] Current user email: $userEmail');
        
        final result = await PaypalService.completeEventPayment(
          eventId: eventId,
          paymentId: paymentId,
          payerId: payerId,
          userEmail: userEmail,
        );
        
        log('[DeepLinkingService] Single event payment API result: $result');
        
        if (result != null && result['success'] == true) {
          log('[DeepLinkingService] Single event payment completed successfully');
          // Close any open dialogs and clear navigation stack
          final nav = (_navigatorKey ?? navigatorKey).currentState;
          if (nav == null) return;

          nav.popUntil((route) => route.isFirst);

          nav.pushNamedAndRemoveUntil(
            '/events',
            (route) => false, // Remove all previous routes
          );

          // Show success message after navigation
          Future.delayed(Duration(milliseconds: 800), () {
            final nav2 = (_navigatorKey ?? navigatorKey).currentState;
            if (nav2 == null || !nav2.mounted) return;
            ScaffoldMessenger.of(nav2.context).showSnackBar(
              SnackBar(
                content: Text('✅ Event payment completed successfully!'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 4),
              ),
            );
          });
        } else {
          log('[DeepLinkingService] Single event payment failed: ${result?['error']}');
          final nav = (_navigatorKey ?? navigatorKey).currentState;
          if (nav != null && nav.mounted) {
            _showEventPaymentErrorDialog(nav.context, result?['error'] ?? 'Payment completion failed');
          }
        }
      }
    } catch (e) {
      log('[DeepLinkingService] Error completing payment: $e');
      final nav = (_navigatorKey ?? navigatorKey).currentState;
      if (nav != null && nav.mounted) {
        _showEventPaymentErrorDialog(nav.context, 'Error completing payment: $e');
      }
    }
  }

  /// Get pending bulk registration data
  static Future<Map<String, dynamic>?> _getPendingBulkRegistration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingDataString = prefs.getString('pending_bulk_registration');
      log('[DeepLinkingService] Raw pending data string: $pendingDataString');
      
      if (pendingDataString != null) {
        final pendingData = jsonDecode(pendingDataString) as Map<String, dynamic>;
        log('[DeepLinkingService] Parsed pending data: $pendingData');
        
        // Check if data is not too old (e.g., within last hour)
        final timestamp = pendingData['timestamp'] as int;
        final now = DateTime.now().millisecondsSinceEpoch;
        final ageMinutes = (now - timestamp) / 60000;
        log('[DeepLinkingService] Pending data age: ${ageMinutes.toStringAsFixed(1)} minutes');
        
        if (now - timestamp < 3600000) { // 1 hour
          log('[DeepLinkingService] Pending data is valid');
          return pendingData;
        } else {
          // Clear old data
          log('[DeepLinkingService] Pending data is too old, clearing');
          await prefs.remove('pending_bulk_registration');
        }
      } else {
        log('[DeepLinkingService] No pending data found');
      }
    } catch (e) {
      log('[DeepLinkingService] Failed to get pending registration: $e');
    }
    return null;
  }

  /// Clear pending bulk registration data
  static Future<void> _clearPendingBulkRegistration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('pending_bulk_registration');
      log('[DeepLinkingService] Cleared pending bulk registration data');
    } catch (e) {
      log('[DeepLinkingService] Failed to clear pending registration: $e');
    }
  }

  /// Show event payment error dialog
  static void _showEventPaymentErrorDialog(BuildContext context, String error) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Error'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error, color: Colors.red, size: 48),
            const SizedBox(height: 16),
            Text(
              'Event payment failed: $error',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'Please try again or contact support if the problem persists.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              Navigator.of(context).pushReplacementNamed('/events');
            },
            child: const Text('Back to Events'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  /// Show event payment cancel dialog
  static void _showEventPaymentCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment Cancelled'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cancel, color: Colors.orange, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Event payment was cancelled. Your registration is not confirmed yet.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            const Text(
              'You can try again later or complete payment at the event if applicable.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Close dialog
              Navigator.of(context).pushReplacementNamed('/events');
            },
            child: const Text('Back to Events'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  /// Clean up resources
  static void dispose() {
    _linkSubscription?.cancel();
  }

  // Notification handler for deep linking (route and link only)
  static Future<void> handleNotificationData(Map<String, dynamic> data) async {
    if (data.isEmpty) return;
    if (data['route'] != null) {
      await _handleRouteNavigation(data['route']);
    }
    if (data['link'] != null) {
      await _handleExternalLink(data['link']);
    }
  }


  /// Handle route navigation (like /event/event1)
  static Future<void> _handleRouteNavigation(String route) async {
    try {
      final context = navigatorKey.currentContext;
      if (context == null) return;

      // Handle event routes specifically
      if (route.startsWith('/event/')) {
        final eventId = route.split('/').last;
        await _handleEventNavigation(eventId);
        return;
      }

      // Handle other standard routes
      await Future.delayed(const Duration(milliseconds: 200));
      navigatorKey.currentState?.pushNamed(route);
    } catch (e) {
      debugPrint('Error navigating to route $route: $e');
    }
  }

  /// Handle event navigation by event ID
  static Future<void> _handleEventNavigation(String eventId) async {
    try {
      final navKey = _navigatorKey ?? navigatorKey;
      final event = await _fetchEventById(eventId);
      if (event == null) {
        return;
      }
      final context = navKey.currentContext;
      if (context != null && context.mounted) {
        try {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => EventShowcase(event: event),
            ),
          );
        } catch (navError) {
          debugPrint('Error in direct navigation: $navError');
        }
      }
    } catch (e) {
      debugPrint('Error navigating to event detail: $e');
    }
  }

  /// Handle external link opening
  static Future<void> _handleExternalLink(String link) async {
    try {
      final uri = Uri.parse(link);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        debugPrint('Could not launch URL: $link');
      }
    } catch (e) {
      debugPrint('Error launching link $link: $e');
    }
  }

  /// Fetch event by ID from the API
  static Future<Event?> _fetchEventById(String eventId) async {
    try {
      final api = ApiClient(
        baseUrl: BackendHelper.apiBase,
      );
      final response = await api.dio.get('/v1/events/$eventId');
      
      if (response.statusCode == 200) {
        return Event.fromJson(response.data);
      } else {
        return null;
      }
    } catch (e) {
      debugPrint('Error fetching event $eventId: $e');
      return null;
    }
  }

  /// Enhanced notification payload builder for backend
  /// Creates properly formatted notification data
  static Map<String, String> buildNotificationData({
    String? actionType,
    String? link,
    String? route,
    int? tab,
    String? eventId,
    Map<String, dynamic>? customData,
  }) {
    final data = <String, String>{};

    if (actionType != null) data['actionType'] = actionType;
    if (link != null) data['link'] = link;
    if (route != null) data['route'] = route;
    if (tab != null) data['tab'] = tab.toString();
    if (eventId != null) data['eventId'] = eventId;

    // Add any custom data
    if (customData != null) {
      for (final entry in customData.entries) {
        data[entry.key] = entry.value.toString();
      }
    }

    return data;
  }
}
