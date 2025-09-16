import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/providers/tab_provider.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

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
        if (Uri.tryParse(payload)?.isAbsolute ?? false) {
          await launchUrl(Uri.parse(payload));
        } else {
          navigatorKey.currentState?.pushNamed(payload);
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
      if (data['tab'] != null) {
        final tabValue = data['tab'];
        if (tabValue is String) {
          TabProvider.instance?.setTabByName(tabValue);
        } else if (tabValue is int) {
          TabProvider.instance?.setTab(tabValue);
        } else {
          // Try to parse string as int if possible
          int? idx = int.tryParse(tabValue.toString());
          if (idx != null) TabProvider.instance?.setTab(idx);
        }
      } else if (data['link'] != null) {
        launchUrl(Uri.parse(data['link']));
      } else if (data['route'] != null) {
        navigatorKey.currentState?.pushNamed(data['route']);
      } else {
        navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => DashboardPage()));
      }
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
  String? payload;
  if (message.data['link'] != null) {
    payload = message.data['link'];
  } else if (message.data['route'] != null) {
    payload = message.data['route'];
  }
  await flutterLocalNotificationsPlugin.show(
    0,
    message.notification?.title,
    message.notification?.body,
    platformChannelSpecifics,
    payload: payload,
  );
}
