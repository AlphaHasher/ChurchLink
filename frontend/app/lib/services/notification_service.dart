import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _fln = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _fln.initialize(const InitializationSettings(
      android: androidInit,
      iOS: iosInit,
    ));

    // ANDROID 13+: ask at runtime (correct API on 19.x)
    if (Platform.isAndroid) {
      final granted = await _fln
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      if (kDebugMode) print('POST_NOTIFICATIONS granted: $granted');
    }
  }

  Future<int> scheduleEventReminder({
    required String eventId,
    required String title,
    required String body,
    required DateTime eventStartLocal,
    required Duration offset,
  }) async {
    final scheduled = eventStartLocal.subtract(offset);
    final id = _stableId(eventId, offset);

    await _fln.zonedSchedule(
      id,
      title,
      body,
      tz.TZDateTime.from(scheduled, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'events',
          'Event Reminders',
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      //androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: eventId,
    );
    return id;
  }

  Future<void> cancelEventReminder(String eventId) async {
    for (final d in [const Duration(hours: 1), const Duration(days: 1)]) {
      await _fln.cancel(_stableId(eventId, d));
    }
  }

  int _stableId(String eventId, Duration offset) =>
      eventId.hashCode ^ offset.inMinutes.hashCode;
}
