import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import 'package:app/services/deep_linking_service.dart';
import 'package:app/main.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  debugPrint("Background notification received: ${message.notification?.title}");
}

Future<void> setupLocalNotifications() async {
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  final DarwinInitializationSettings initializationSettingsIOS = DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );
  final InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
    iOS: initializationSettingsIOS,
  );
  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) async {
      final payload = response.payload;
      if (payload != null && payload.isNotEmpty) {
        debugPrint('Local notification tapped with payload: $payload');
        
        try {
          // Try to parse payload as JSON first (new format with complete data)
          final Map<String, dynamic> data = jsonDecode(payload);
          debugPrint('Parsed JSON data from payload: $data');
          await DeepLinkingService.handleNotificationData(data);
        } catch (e) {
          debugPrint('Failed to parse JSON payload, trying legacy format: $e');
          // Fallback to legacy single-value payload handling
          try {
            final Map<String, dynamic> data = {};
            if (Uri.tryParse(payload)?.isAbsolute ?? false) {
              data['link'] = payload;
            } else if (payload.startsWith('/event/')) {
              // Extract eventId from route format
              final eventId = payload.split('/').last;
              data['eventId'] = eventId;
              data['actionType'] = 'event';
            } else {
              data['route'] = payload;
            }
            debugPrint('Using legacy fallback data: $data');
            await DeepLinkingService.handleNotificationData(data);
          } catch (fallbackError) {
            debugPrint('Legacy fallback failed: $fallbackError');
            // Final fallback to original simple handling
            if (Uri.tryParse(payload)?.isAbsolute ?? false) {
              await launchUrl(Uri.parse(payload));
            } else {
              navigatorKey.currentState?.pushNamed(payload);
            }
          }
        }
      }
    },
  );
}

void setupFirebaseMessaging() async {
  FirebaseMessaging messaging = FirebaseMessaging.instance;
  NotificationSettings settings = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
    provisional: false,
  );
  if (settings.authorizationStatus == AuthorizationStatus.authorized) {
    debugPrint("User granted permission");
    String? token = await messaging.getToken();
    debugPrint("Firebase Token: $token");
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint("Foreground message received: ${message.notification?.title}");
      showLocalNotification(message);
    });
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint("Notification clicked!");
      final data = message.data;
      debugPrint("Notification data: $data");
      
      // Use enhanced deep linking service for notification handling
      DeepLinkingService.handleNotificationData(data);
    });
  } else {
    debugPrint("User denied permission");
  }
}

void showLocalNotification(RemoteMessage message) async {
  const AndroidNotificationDetails androidPlatformChannelSpecifics =
      AndroidNotificationDetails(
    'high_importance_channel',
    'High Importance Notifications',
    importance: Importance.max,
    priority: Priority.high,
    ticker: 'ticker',
  );
  const DarwinNotificationDetails iosPlatformChannelSpecifics = DarwinNotificationDetails();
  const NotificationDetails platformChannelSpecifics = NotificationDetails(
    android: androidPlatformChannelSpecifics,
    iOS: iosPlatformChannelSpecifics,
  );
  
  // Enhanced payload construction for local notifications
  String? payload;
  if (message.data.isNotEmpty) {
    // Convert the full data to JSON string to preserve all notification data
    try {
      payload = jsonEncode(message.data);
    } catch (e) {
      // Fallback to legacy single-value payload
      if (message.data['link'] != null) {
        payload = message.data['link'];
      } else if (message.data['route'] != null) {
        payload = message.data['route'];
      } else if (message.data['eventId'] != null) {
        // Store eventId as a special route format
        payload = '/event/${message.data['eventId']}';
      }
    }
  }
  
  await flutterLocalNotificationsPlugin.show(
    0,
    message.notification?.title,
    message.notification?.body,
    platformChannelSpecifics,
    payload: payload,
  );
}

