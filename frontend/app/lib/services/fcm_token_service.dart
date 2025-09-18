import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:developer';
import 'package:flutter_dotenv/flutter_dotenv.dart';

Future<void> sendFcmTokenToBackend(String userId) async {
  final token = await FirebaseMessaging.instance.getToken();
  log('sendFcmTokenToBackend called for userId: $userId');
  log('FCM token: $token');
  if (token != null) {
    final backendUrl = dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
    final url = Uri.parse('$backendUrl/api/v1/paypal/save-fcm-token');
    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'user_id': userId, 'token': token}),
      );
      log('FCM token save response: ${response.statusCode} ${response.body}');
    } catch (e) {
      log('Error sending FCM token to backend: $e');
    }
  } else {
    log('FCM token is null, not sending to backend');
  }
}
