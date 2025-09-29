import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({super.key});

  @override
  State<NotificationSettingsPage> createState() => _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  String? _idToken;
  bool _usedAnonymousForApi = false;
  Map<String, bool> _notificationPrefs = {};
  final Map<String, bool> _defaultPrefs = {
    'Event Notification': true,
    'App Announcements': true,
    'Live Stream Alerts': true,
  };
  bool _loading = true;
  String get _baseUrl => '${dotenv.env['BACKEND_URL'] ?? 'http://10.0.2.2:8000/'}api/v1/notification/preferences';

  @override
  void initState() {
    super.initState();
    _authenticateAndFetchPrefs();
    // Listen for auth state changes to automate sync
    FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user != null && !user.isAnonymous && _usedAnonymousForApi && _notificationPrefs.isNotEmpty) {
        _idToken = await user.getIdToken();
        await _updateNotificationPrefs();
        setState(() {
          _usedAnonymousForApi = false;
        });
      }
    });
  }

  Future<void> _authenticateAndFetchPrefs() async {
  // Use anonymous sign-in only for API
    User? user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      UserCredential cred = await FirebaseAuth.instance.signInAnonymously();
      user = cred.user;
      _usedAnonymousForApi = true;
    } else if (user.isAnonymous) {
      _usedAnonymousForApi = true;
    }
    _idToken = await user?.getIdToken();
    await _fetchNotificationPrefs();
  }

  Future<void> _fetchNotificationPrefs() async {
    setState(() { _loading = true; });
    try {
      final response = await http.get(
        Uri.parse(_baseUrl),
        headers: _idToken != null ? {'Authorization': 'Bearer $_idToken'} : {},
      );
      debugPrint('Notification prefs response: ${response.body}'); // Debug print
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        Map<String, bool> prefs = Map<String, bool>.from(data['notification_preferences'] ?? {});
        if (prefs.isEmpty) {
          prefs = Map<String, bool>.from(_defaultPrefs);
        }
        setState(() {
          _notificationPrefs = prefs;
        });
      }
    } catch (e) {
      debugPrint('Error fetching notification prefs: $e'); // Debug print
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _updateNotificationPrefs() async {
    try {
      final response = await http.post(
        Uri.parse(_baseUrl),
        headers: {
          'Content-Type': 'application/json',
          if (_idToken != null) 'Authorization': 'Bearer $_idToken',
        },
        body: json.encode({'notification_preferences': _notificationPrefs}),
      );
      debugPrint('Update notification prefs response: ${response.body}'); // Debug print
      if (response.statusCode != 200) {
        debugPrint('Failed to update notification prefs: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error updating notification prefs: $e'); // Debug print
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
                        _updateNotificationPrefs();
                      },
                    )),
                if (_usedAnonymousForApi)
                  const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text(
                      'You are not logged in. These preferences are saved anonymously and will not sync to a real account.',
                      style: TextStyle(color: Colors.red, fontSize: 14),
                    ),
                  ),
              ],
            ),
    );
  }
}
