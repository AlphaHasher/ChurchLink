import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:app/helpers/user_helper.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/pages/user/edit_contact_info.dart';
import 'package:app/pages/user/edit_profile.dart';
import 'package:app/pages/user/family_members_page.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;

import '../../components/auth_popup.dart';
import '../../components/password_reset.dart';
import '../../firebase/firebase_auth_service.dart';
import 'edit_profile.dart';
import 'family_members_page.dart';
import 'notification_settings_page.dart';
import '../my_events_page.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:app/theme/theme_controller.dart';


class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final ScrollController _scrollController = ScrollController();
  final FirebaseAuthService authService = FirebaseAuthService();

  File? _profileImage;
  bool _isUploading = false;

  StreamSubscription<User?>? _authSub;
  StreamSubscription<User?>? _userSub;

  ProfileInfo? _profile; // backend truth (cached/online)

  @override
  void initState() {
    super.initState();

    _authSub = FirebaseAuth.instance.authStateChanges().listen((_) async {
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      setState(() {});
      if (_scrollController.hasClients) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scrollController.hasClients) return;
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 100),
            curve: Curves.easeOut,
          );
        });
      }
    });

    _userSub = FirebaseAuth.instance.userChanges().listen((_) async {
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      setState(() {});
    });

    _loadProfile();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _userSub?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (!mounted) return;
      setState(() => _profile = null);
      return;
    }

    final ok = await _tryFetchOnlineProfile();
    if (!ok) {
      final cached = await UserHelper.readCachedProfile();
      if (!mounted) return;
      setState(() {
        _profile =
            cached ??
            ProfileInfo(
              firstName: (user.displayName ?? '').split(' ').firstOrNull ?? '',
              lastName: (user.displayName ?? '').split(' ').skip(1).join(' '),
              email: user.email ?? '',
              birthday: null,
              gender: null,
            );
      });
    }
  }

  Future<bool> _tryFetchOnlineProfile() async {
    try {
      final p = await UserHelper.getMyProfile();
      if (p == null) return false;
      if (!mounted) return true;
      setState(() => _profile = p);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? pickedImage = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (pickedImage == null) return;

    if (!mounted) return;
    setState(() => _isUploading = true);

    final file = File(pickedImage.path);
    final user = FirebaseAuth.instance.currentUser;

    try {
      if (user?.photoURL != null) {
        await _deleteOldImage(user!.photoURL!);
      }

      final uri = Uri.parse(
        "https://api.cloudinary.com/v1_1/${dotenv.env['CLOUDINARY_CLOUD_NAME']}/image/upload",
      );

      final request =
          http.MultipartRequest("POST", uri)
            ..fields['upload_preset'] = "user_avatars"
            ..files.add(await http.MultipartFile.fromPath('file', file.path));

      final response = await request.send();
      final responseData = await response.stream.bytesToString();
      final jsonData = jsonDecode(responseData);

      final imageUrl = jsonData['secure_url'] as String;

      await user?.updatePhotoURL(imageUrl);
      await user?.reload();

      if (!mounted) return;
      setState(() {
        _profileImage = file;
        _isUploading = false;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Profile picture updated!")));
    } catch (e) {
      if (!mounted) return;
      setState(() => _isUploading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Failed to update avatar: $e")));
    }
  }

  Future<void> _deleteOldImage(String imageUrl) async {
    final uri = Uri.parse(imageUrl);
    final fileName = uri.pathSegments.last.split('.').first;

    final deleteUri = Uri.parse(
      "https://api.cloudinary.com/v1_1/${dotenv.env['CLOUDINARY_CLOUD_NAME']}/image/destroy",
    );

    await http.post(
      deleteUri,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "public_id": fileName,
        "api_key": dotenv.env['CLOUDINARY_API_KEY'],
      }),
    );
  }

  // Show the theme selection bottom sheet
  void _showThemeSheet() {
    final current = ThemeController.instance.mode;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.wb_sunny_outlined),
                title: const Text('Light'),
                trailing: current == ThemeMode.light ? const Icon(Icons.check) : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.light);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                leading: const Icon(Icons.brightness_auto),
                title: const Text('System'),
                trailing: current == ThemeMode.system ? const Icon(Icons.check) : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.system);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                leading: const Icon(Icons.nights_stay_outlined),
                title: const Text('Dark'),
                trailing: current == ThemeMode.dark ? const Icon(Icons.check) : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.dark);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    final user = authService.getCurrentUser();
    final bool loggedIn = user != null;

    final displayName =
        (() {
          final p = _profile;
          if (p != null) {
            final fn = p.firstName.trim();
            final ln = p.lastName.trim();
            final joined = [fn, ln].where((s) => s.isNotEmpty).join(' ').trim();
            if (joined.isNotEmpty) return joined;
          }
          return user?.displayName ?? "(Please set your display name)";
        })();

    final displayEmail =
        (() {
          final email = _profile?.email;
          if (email != null && email.trim().isNotEmpty) return email.trim();
          return user?.email ?? "(Please set your display email)";
        })();

    final mode = ThemeController.instance.mode;
    final themeLabel = switch (mode) {
      ThemeMode.light  => 'Light',
      ThemeMode.dark   => 'Dark',
      ThemeMode.system => 'System',
    };

    final List<Map<String, dynamic>> settingsCategories = [
      {
        'category': 'Account',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': 'Edit Profile',
            'subtitle': 'First/Last name, birthday, gender',
            'ontap': () async {
              if (user == null) return;
              // Await result and update immediately if we get a ProfileInfo back
              final result = await Navigator.push<ProfileInfo>(
                context,
                MaterialPageRoute(
                  builder:
                      (context) => EditProfileScreen(
                        user: user,
                        initialProfile: _profile,
                      ),
                ),
              );
              if (!mounted) return;
              if (result != null) {
                setState(() => _profile = result);
              }
            },
          },
          {
            'icon': Icons.contact_page,
            'title': 'Edit Contact Info',
            'subtitle': 'Phone and address',
            'ontap': () {
              if (user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditContactInfoScreen(user: user),
                  ),
                );
              }
            },
          },
          {
            'icon': Icons.family_restroom,
            'title': 'Family Members',
            'subtitle': 'Manage your family members',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const FamilyMembersPage(),
                ),
              );
            },
          },
          {
            'icon': Icons.event,
            'title': 'My Events',
            'subtitle': 'Your registrations and RSVPs',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const MyEventsPage()),
              );
            },
          },
          {
            'icon': Icons.image,
            'title': 'Change Avatar',
            'subtitle': 'Update your profile picture',
            'ontap': _pickImage,
          },
          {
            'icon': Icons.password,
            'title': 'Change Password',
            'subtitle': 'Request an email to reset your password',
            'ontap': () {
              PasswordReset.show(context, user?.email);
            },
          },
        ],
      },
      {
        'category': 'Guest',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': 'Login or Signup',
            'subtitle': 'To access more features login or signup',
            'ontap': () {
              AuthPopup.show(context);
            },
          },
        ],
      },
      {
        'category': 'Preferences',
        'items': [
          {
            'icon': Icons.dark_mode,
            'title': 'Theme',
            'subtitle': themeLabel,
            'ontap': _showThemeSheet,
          },
          {
            'icon': Icons.language,
            'title': 'Language',
            'subtitle': 'Change app language',
          },
          {
            'icon': Icons.notifications,
            'title': 'Notifications',
            'subtitle': 'Customize alert preferences',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const NotificationSettingsPage(),
                ),
              );
            },
          },
        ],
      },
      {
        'category': 'Privacy',
        'items': [
          {
            'icon': Icons.visibility,
            'title': 'Account Visibility',
            'subtitle': 'Who can see your profile',
          },
          {
            'icon': Icons.delete,
            'title': 'Delete Account',
            'subtitle': 'Permanently remove your data',
          },
        ],
      },
      {
        'category': 'Support',
        'items': [
          {
            'icon': Icons.help,
            'title': 'Help Center',
            'subtitle': 'FAQ and support resources',
          },
          {
            'icon': Icons.feedback,
            'title': 'Send Feedback',
            'subtitle': 'Help us improve',
          },
          {
            'icon': Icons.policy,
            'title': 'Terms & Policies',
            'subtitle': 'Privacy policy and terms of use',
          },
        ],
      },
    ];

    final List<Widget> pageWidgets = [];

    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: ssbcGray,
                    backgroundImage:
                        _profileImage != null
                            ? FileImage(_profileImage!) as ImageProvider
                            : (user?.photoURL != null &&
                                    user!.photoURL!.isNotEmpty
                                ? NetworkImage(user.photoURL!)
                                : const AssetImage('assets/user/ssbc-dove.png')
                                    as ImageProvider),
                  ),
                  if (_isUploading)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black.withOpacity(0.3),
                        child: const Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    displayEmail,
                    style: const TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    pageWidgets.add(const SizedBox(height: 16));

    for (final category in settingsCategories) {
      final catName = category['category'] as String;
      if ((catName == 'Account' || catName == 'Privacy') && !loggedIn) {
        continue;
      }
      if (catName == 'Guest' && loggedIn) continue;

      pageWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            catName,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      );

      for (final item in (category['items'] as List<dynamic>)) {
        pageWidgets.add(
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              leading: Icon(item['icon'] as IconData, color: ssbcGray),
              title: Text(item['title'] as String),
              subtitle: Text(item['subtitle'] as String),
              trailing: item['trailing'] as Widget? 
                  ?? const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: item['ontap'] as void Function()?,
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () async {
              authService.signOut();
              await UserHelper.clearCachedStatus();
              await UserHelper.clearCachedProfile();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ssbcGray,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Logout', style: TextStyle(fontSize: 16)),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
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

extension _SplitName on String {
  String? get firstOrNull {
    final parts = trim().split(RegExp(r'\s+'));
    return parts.isEmpty ? null : parts.first;
  }
}
