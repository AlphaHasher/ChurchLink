import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/localization_helper.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({super.key});

  @override
  State<NotificationSettingsPage> createState() => _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  String? _fcmToken;
  Map<String, bool> _notificationPrefs = {};
  final Map<String, bool> _defaultPrefs = {
    'Event Notification': true,
    'App Announcements': true,
    'Live Stream Alerts': true,
    'Bible Plan Reminders': true,
  };
  bool _loading = true;
  String get _baseUrl => '${dotenv.env['BACKEND_URL'] ?? 'http://10.0.2.2:8000/'}api/v1/notification/preferences';

  @override
  void initState() {
    super.initState();
    _fetchFcmTokenAndPrefs();
  }

  Future<void> _fetchFcmTokenAndPrefs() async {
    setState(() { _loading = true; });
    try {
      // Get FCM token for this device
      _fcmToken = await FirebaseMessaging.instance.getToken();
      debugPrint('FCM token used for GET: $_fcmToken');
      await _fetchNotificationPrefs();
    } catch (e) {
      debugPrint('Error fetching FCM token: $e');
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _fetchNotificationPrefs() async {
    setState(() { _loading = true; });
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl?token=$_fcmToken'),
      );
      debugPrint('Notification prefs response: ${response.body}');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
  final rawPrefs = data['notification_preferences'] ?? {};
        Map<String, bool> prefs = Map.fromEntries(
          (rawPrefs as Map<String, dynamic>).entries.map((entry) {
            final key = entry.key;
            final value = entry.value;
            if (value is bool) return MapEntry(key, value);
            if (value is String) return MapEntry(key, value.toLowerCase() == 'true');
            return MapEntry(key, false);
          }),
        );
        if (prefs.isEmpty) {
          prefs = Map<String, bool>.from(_defaultPrefs);
        }
        setState(() {
          _notificationPrefs = prefs;
        });
      }
    } catch (e) {
      debugPrint('Error fetching notification prefs: $e');
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _updateNotificationPrefs() async {
    try {
      final response = await api.post(
        '/v1/notification/preferences',
        data: {
          'token': _fcmToken,
          'preferences': _notificationPrefs,
        },
      );
      debugPrint('Update notification prefs response: \\${response.data}');
      // You may want to check response status or handle errors as needed
    } catch (e) {
      debugPrint('Error updating notification prefs: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                 Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    LocalizationHelper.localize('Choose which notifications you want to receive:'),
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                ..._notificationPrefs.entries.map((entry) => SwitchListTile(
                      title: Text(LocalizationHelper.localize(entry.key)),
                      value: entry.value,
                      onChanged: (val) {
                        setState(() {
                          _notificationPrefs[entry.key] = val;
                        });
                        _updateNotificationPrefs();
                      },
                    )),
              ],
            ),
    );
  }
}
