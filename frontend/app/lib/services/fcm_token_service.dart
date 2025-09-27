import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:developer';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class FCMTokenService {
  static bool _tokenSent = false;
  
  /// Send FCM token to backend (with duplicate prevention)
  static Future<void> sendFcmTokenToBackend(String userId) async {
    if (_tokenSent) {
      log('FCM token already sent in this session, skipping...');
      return;
    }

    final token = await FirebaseMessaging.instance.getToken();
    log('=== FCM TOKEN SERVICE DEBUG ===');
    log('sendFcmTokenToBackend called for userId: $userId');
    log('FCM token: $token');
    
    if (token != null) {
      final backendUrl = dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
      final fullUrl = '$backendUrl/api/v1/notification/save-fcm-token';
      log('Backend URL: $backendUrl');
      log('Full API URL: $fullUrl');
      
      try {
        final requestBody = json.encode({'user_id': userId, 'token': token});
        log('Request body: $requestBody');
        
        final response = await http.post(
          Uri.parse(fullUrl),
          headers: {'Content-Type': 'application/json'},
          body: requestBody,
        );
        
        log('FCM token save response status: ${response.statusCode}');
        log('FCM token save response body: ${response.body}');
        
        if (response.statusCode == 200) {
          log('✅ FCM token saved successfully!');
          _tokenSent = true; // Mark as sent to prevent duplicates
        } else {
          log('❌ FCM token save failed with status: ${response.statusCode}');
        }
      } catch (e) {
        log('❌ Error sending FCM token to backend: $e');
        log('Stack trace: ${StackTrace.current}');
      }
    } else {
      log('❌ FCM token is null, not sending to backend');
    }
    log('=== END FCM TOKEN SERVICE DEBUG ===');
  }
  
  /// Initialize FCM token management for current user
  static Future<void> initializeForCurrentUser() async {
    final user = FirebaseAuth.instance.currentUser;
    
    if (user != null) {
      // Logged in user
      log('Initializing FCM token for logged-in user: ${user.uid}');
      await sendFcmTokenToBackend(user.uid);
      
      // Listen for token refresh
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        log('FCM token refreshed for logged-in user: $newToken');
        _tokenSent = false; // Reset flag to allow sending new token
        sendFcmTokenToBackend(user.uid);
      });
    } else {
      // Anonymous user - still send FCM token for push notifications
      log('No logged-in user found, initializing FCM token for anonymous user');
      await sendFcmTokenToBackend('anonymous');
      
      // Listen for token refresh for anonymous users too
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        log('FCM token refreshed for anonymous user: $newToken');
        _tokenSent = false; // Reset flag to allow sending new token
        sendFcmTokenToBackend('anonymous');
      });
    }
  }
  
  /// Reset the token sent flag (call when user logs out)
  static void reset() {
    _tokenSent = false;
  }
}

// Legacy function for backward compatibility
Future<void> sendFcmTokenToBackend(String userId) async {
  return FCMTokenService.sendFcmTokenToBackend(userId);
}
