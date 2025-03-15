import 'package:app/pages/user/edit_profile.dart';
import 'package:app/pages/user/guest_settings.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../firebase/firebase_auth_service.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final FirebaseAuthService _authService = FirebaseAuthService();
  User? _user;

  @override
  void initState() {
    super.initState();
    _fetchUser();
  }

  void _fetchUser() async {
    User? currentUser = FirebaseAuth.instance.currentUser;
    setState(() {
      _user = currentUser;
    });
  }
  
  final List<Map<String, dynamic>> _settingsCategories = [
    {
      'category': 'Account',
      'items': [
        {'icon': Icons.account_circle, 'title': 'Edit Profile', 'subtitle': 'Name, email, phone number'},
        {'icon': Icons.image, 'title': 'Change Avatar', 'subtitle': 'Update your profile picture'},
        {'icon': Icons.password, 'title': 'Change Password', 'subtitle': 'Update your password'},
      ]
    },
    {
      'category': 'Preferences',
      'items': [
        {'icon': Icons.dark_mode, 'title': 'Theme', 'subtitle': 'Light or dark mode'},
        {'icon': Icons.language, 'title': 'Language', 'subtitle': 'Change app language'},
        {'icon': Icons.notifications, 'title': 'Notifications', 'subtitle': 'Customize alert preferences'},
      ]
    },
    {
      'category': 'Privacy',
      'items': [
        {'icon': Icons.visibility, 'title': 'Account Visibility', 'subtitle': 'Who can see your profile'},
        {'icon': Icons.delete, 'title': 'Delete Account', 'subtitle': 'Permanently remove your data'},
      ]
    },
    {
      'category': 'Support',
      'items': [
        {'icon': Icons.help, 'title': 'Help Center', 'subtitle': 'FAQ and support resources'},
        {'icon': Icons.feedback, 'title': 'Send Feedback', 'subtitle': 'Help us improve'},
        {'icon': Icons.policy, 'title': 'Terms & Policies', 'subtitle': 'Privacy policy and terms of use'},
      ]
    },
    {
      'category': 'LogOut',
      'items': [
        {'icon': Icons.account_circle, 'title': 'Log Out'}
      ]
    },
  ];

  @override
  Widget build(BuildContext context) {
    List<Widget> pageWidgets = [];
    const Color SSBC_GRAY = Color.fromARGB(255, 142, 163, 168);

    // Profile card
    pageWidgets.add(
      Container(
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            const CircleAvatar(
              radius: 32,
              backgroundColor: SSBC_GRAY,
              child: Icon(
                Icons.person,
                size: 40,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _user != null ? _user!.displayName ?? 'Guest User' : 'Guest User',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _user != null ? _user!.email ?? 'guest@example.com' : 'guest@example.com',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    pageWidgets.add(const SizedBox(height: 16));

    // Logout Button
    pageWidgets.add(
      ElevatedButton(
        onPressed: () async {
          await _authService.signOut();
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => GuestSettings()),
          );
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: SSBC_GRAY,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: const Text(
          'Logout',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );

    pageWidgets.add(const SizedBox(height: 16));

    // Generate categories and items from list
    for (var category in _settingsCategories) {
      pageWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            category['category'],
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      );

      for (var item in category['items']) {
        pageWidgets.add(
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              leading: Icon(
                item['icon'],
                color: SSBC_GRAY,
              ),
              title: Text(item['title']),
              subtitle: item.containsKey('subtitle') ? Text(item['subtitle']) : null,
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: () async {
                if (item['title'] == 'Edit Profile' && _user != null) {
                  User? updatedUser = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => EditProfileScreen(user: _user!),
                    ),
                  );

                  if (updatedUser != null) {
                    setState(() {
                      _user = updatedUser; // Update UI after editing profile
                    });
                  }
                }
              },
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: SSBC_GRAY,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          "User Settings",
          style: TextStyle(color: Colors.white),
        ),
        centerTitle: true,
      ),
      backgroundColor: const Color.fromARGB(255, 245, 245, 245),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          children: pageWidgets,
        ),
      ),
    );
  } 
}