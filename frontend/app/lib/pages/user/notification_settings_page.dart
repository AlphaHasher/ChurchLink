import 'package:flutter/material.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({super.key});

  @override
  State<NotificationSettingsPage> createState() => _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  // Example notification types
  final Map<String, bool> _notificationPrefs = {
    'Event Reminders': true,
    'App Announcements': true,
    'Live Stream Alerts': true,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        centerTitle: true,
      ),
      body: ListView(
        children: [
          const Padding(
            padding: EdgeInsets.all(16.0),
            child: Text(
              'Choose which notifications you want to receive:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          ..._notificationPrefs.entries.map((entry) => SwitchListTile(
                title: Text(entry.key),
                value: entry.value,
                onChanged: (val) {
                  setState(() {
                    _notificationPrefs[entry.key] = val;
                  });
                },
              ))
        ],
      ),
    );
  }
}
