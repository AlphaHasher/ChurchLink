import 'package:flutter/material.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
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
  ];

  @override
  Widget build(BuildContext context) {
    // Create a flat list of all widgets to avoid nested scrollables
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
              children: const [
                Text(
                  'John Doe',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'john.doe@example.com',
                  style: TextStyle(
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
              subtitle: Text(item['subtitle']),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: () {
                // Add your navigation logic here
              },
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    // Add logout button
    pageWidgets.add(
      Container(
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
        width: double.infinity,
        child: ElevatedButton(
          onPressed: () {
            // Add logout logic
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
      ),
    );

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