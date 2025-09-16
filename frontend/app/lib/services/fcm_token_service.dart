import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/material.dart';

Future<void> sendFcmTokenToBackend(String userId) async {
  final token = await FirebaseMessaging.instance.getToken();
  debugPrint('sendFcmTokenToBackend called for userId: $userId');
  debugPrint('FCM token: $token');
  if (token != null) {
    try {
      final response = await http.post(
        Uri.parse('http://10.0.2.2:8000/api/save-fcm-token'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'user_id': userId, 'token': token}),
      );
      debugPrint('FCM token save response: ${response.statusCode} ${response.body}');
    } catch (e) {
      debugPrint('Error sending FCM token to backend: $e');
    }
  } else {
    debugPrint('FCM token is null, not sending to backend');
  }
}
