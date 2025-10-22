import 'dart:async';

import 'package:app/helpers/user_helper.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/pages/user/edit_contact_info.dart';
import 'package:app/pages/user/edit_profile.dart';
import 'package:app/pages/user/family_members_page.dart';
import 'package:app/pages/user/membership_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/components/auth_popup.dart';
import 'package:app/components/password_reset.dart';
import 'package:app/pages/user/notification_settings_page.dart';
import 'package:app/pages/my_events_page.dart';
import 'package:app/theme/theme_controller.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final ScrollController _scrollController = ScrollController();
  final FirebaseAuthService authService = FirebaseAuthService();

  StreamSubscription<User?>? _authSub;
  StreamSubscription<User?>? _userSub;

  ProfileInfo? _profile; // backend truth (cached/online)
  String _selectedLanguage = 'English'; // Language preference

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
      setState(() {
        _profile = null;
      });
      return;
    }

    final ok = await _tryFetchOnlineProfile();
    if (!ok) {
      final cachedProfile = await UserHelper.readCachedProfile();
      if (!mounted) return;
      setState(() {
        _profile =
            cachedProfile ??
            ProfileInfo(
              firstName: (user.displayName ?? '').split(' ').firstOrNull ?? '',
              lastName: (user.displayName ?? '').split(' ').skip(1).join(' '),
              email: user.email ?? '',
              membership: false,
              birthday: null,
              gender: null,
            );
      });
    }
  }

  Future<bool> _tryFetchOnlineProfile() async {
    try {
      final data = await UserHelper.getMyProfile();
      if (data == null) return false;
      if (!mounted) return true;
      setState(() {
        _profile = data.profile;
      });
      return true;
    } catch (_) {
      return false;
    }
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
                trailing: current == ThemeMode.light
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.light);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                leading: const Icon(Icons.brightness_auto),
                title: const Text('System'),
                trailing: current == ThemeMode.system
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.system);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                leading: const Icon(Icons.nights_stay_outlined),
                title: const Text('Dark'),
                trailing: current == ThemeMode.dark
                    ? const Icon(Icons.check)
                    : null,
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

  // Show language selection bottom sheet
  void _showLanguageSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text(
                  'Select Language',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: const Text('English'),
                trailing: _selectedLanguage == 'English'
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  setState(() => _selectedLanguage = 'English');
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Language set to English'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: const Text('Russian (Русский)'),
                trailing: _selectedLanguage == 'Russian'
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  setState(() => _selectedLanguage = 'Russian');
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Язык установлен на русский'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  // Show Terms and Policies popup
  void _showTermsAndPolicies(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Terms & Policies'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Trust me bro',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('.'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = authService.getCurrentUser();
    final bool loggedIn = user != null;

    final displayName = (() {
      final p = _profile;
      if (p != null) {
        final fn = p.firstName.trim();
        final ln = p.lastName.trim();
        final joined = [fn, ln].where((s) => s.isNotEmpty).join(' ').trim();
        if (joined.isNotEmpty) return joined;
      }
      return user?.displayName ?? "(Please set your display name)";
    })();

    final displayEmail = (() {
      final email = _profile?.email;
      if (email != null && email.trim().isNotEmpty) return email.trim();
      return user?.email ?? "(Please set your display email)";
    })();

    final mode = ThemeController.instance.mode;
    final themeLabel = switch (mode) {
      ThemeMode.light => 'Light',
      ThemeMode.dark => 'Dark',
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
                  builder: (context) =>
                      EditProfileScreen(user: user, initialProfile: _profile),
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
            'icon': Icons.card_membership,
            'title': 'View Membership Status',
            'subtitle': 'View your Church Membership Status',
            'ontap': () {
              if (user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => MembershipScreen()),
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
            'subtitle': _selectedLanguage,
            'ontap': _showLanguageSheet,
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
            'icon': Icons.policy,
            'title': 'Terms & Policies',
            'subtitle': 'Privacy policy and terms of use',
            'ontap': () => _showTermsAndPolicies(context),
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
              CircleAvatar(
                radius: 32,
                backgroundColor: theme.colorScheme.primary,
                backgroundImage: (user.photoURL != null && user.photoURL!.isNotEmpty
                    ? NetworkImage(user.photoURL!)
                    : const AssetImage('assets/user/ssbc-dove.png')
                        as ImageProvider),
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
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: theme.colorScheme.primary.withOpacity(0.2),
                width: 3,
              ),
            ),
            shadowColor: Colors.black.withOpacity(0.1),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 8,
                    spreadRadius: 0,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ListTile(
                leading: Icon(
                  item['icon'] as IconData,
                  color: theme.colorScheme.primary,
                ),
                title: Text(item['title'] as String),
                subtitle: Text(item['subtitle'] as String),
                trailing:
                    item['trailing'] as Widget? ??
                    const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: item['ontap'] as void Function()?,
              ),
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
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.08),
                blurRadius: 8,
                spreadRadius: 0,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: () async {
              authService.signOut();
              await UserHelper.clearCachedStatus();
              await UserHelper.clearCachedProfile();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: theme.colorScheme.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 12),
              elevation: 0,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: theme.colorScheme.primary.withOpacity(0.3),
                  width: 4,
                ),
              ),
            ),
            child: const Text('Logout', style: TextStyle(fontSize: 16)),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text("User Settings"), centerTitle: true),
      backgroundColor: theme.brightness == Brightness.dark
          ? theme.colorScheme.surface
          : theme.colorScheme.surfaceContainerLow,
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
