import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/auth_popup.dart';
import '../../components/password_reset.dart';
import '../../firebase/firebase_auth_service.dart';
import 'edit_profile.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({
    super.key
  });

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final ScrollController _scrollController = ScrollController();
  FirebaseAuthService authService = FirebaseAuthService();
  File? _profileImage;
  final _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();

    // Listen for auth state changes
    FirebaseAuth.instance.authStateChanges().listen((User? user) {
      setState(() {});
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    });

    // Listen for user changes
    FirebaseAuth.instance.userChanges().listen((User? user) {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final XFile? pickedImage = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );

    if (pickedImage != null) {
      setState(() {
        _profileImage = File(pickedImage.path);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    List<Widget> pageWidgets = [];
    const Color SSBC_GRAY = Color.fromARGB(255, 142, 163, 168);
    FirebaseAuthService authService = FirebaseAuthService();
    bool loggedIn = authService.getCurrentUser() != null;
    User? user = authService.getCurrentUser();

    final List<Map<String, dynamic>> settingsCategories = [
      {
        'category': 'Account',
        'items': [
          {
            'icon': Icons.account_circle, 'title': 'Edit Profile', 'subtitle': 'Name, email, phone number',
            'ontap': () {
              if(user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(user: user),
                  ),
                );
              }
            }
          },
          {'icon': Icons.image, 'title': 'Change Avatar', 'subtitle': 'Update your profile picture',
            'ontap': () {_pickImage();}
          },
          {'icon': Icons.password, 'title': 'Change Password', 'subtitle': 'Request an email to reset your password',
            'ontap': () {PasswordReset.show(context);}
          },
        ]
      },
      {
        'category': 'Guest',
        'items': [
          {'icon': Icons.account_circle, 'title': 'Login or Signup', 'subtitle': 'To access more features login or signup',
            'ontap': () {
              AuthPopup.show(context);
            }
          },
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

    // Profile card
    pageWidgets.add(
      Container(
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: SSBC_GRAY,
              backgroundImage: const AssetImage('assets/user/ssbc-dove.png'),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  loggedIn ? (user?.displayName ?? "(Please set your display name") : 'Guest',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                loggedIn ? Text(
                    user?.email ?? "(Please set your display email)",
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.grey,
                    ),
                ): const SizedBox(),
              ],
            ),
          ],
        ),
      ),
    );

    pageWidgets.add(const SizedBox(height: 16));

    // Generate categories and items from list
    for (var category in settingsCategories) {
      // Either show account or guest based on login status
      switch(category['category']) {
        case 'Account' || 'Privacy':
          if(!loggedIn) continue; break;
        case 'Guest':
          if(loggedIn) continue; break;
      }

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
              onTap: item['ontap'],
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    // Add logout button
    if(loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              //Logout with auth
              authService.signOut();
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
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          children: pageWidgets,
        ),
      ),
    );
  }
}